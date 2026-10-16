// Minimal Google Drive v3 client (service account, zero dependencies).
// Used as a "database": every record set is a text file (JSON/CSV) inside one Drive folder.
import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const b64url = (input) => Buffer.from(input).toString('base64url');

export function createDriveClient({ credentials, folderId, fetchImpl = fetch, now = () => Date.now() }) {
  if (!credentials?.client_email || !credentials?.private_key) throw new Error('Geçersiz servis hesabı anahtarı');
  if (!/^[\w-]{10,}$/.test(folderId || '')) throw new Error('Geçersiz DRIVE_FOLDER_ID');

  let token = null;
  let tokenExpiry = 0;
  const fileIds = new Map();

  async function accessToken() {
    if (token && now() < tokenExpiry - 60_000) return token;
    const iat = Math.floor(now() / 1000);
    const claim = { iss: credentials.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 };
    const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claim))}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key, 'base64url');
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    });
    if (!res.ok) throw new Error(`Drive yetkilendirme hatası (${res.status})`);
    const data = await res.json();
    token = data.access_token;
    tokenExpiry = iat * 1000 + (data.expires_in || 3600) * 1000;
    return token;
  }

  async function call(url, options = {}) {
    const res = await fetchImpl(url, {
      ...options,
      headers: { Authorization: `Bearer ${await accessToken()}`, ...(options.headers || {}) },
    });
    if (!res.ok) throw new Error(`Drive isteği başarısız (${res.status})`);
    return res;
  }

  async function findId(name) {
    if (fileIds.has(name)) return fileIds.get(name);
    const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `name = '${escaped}' and '${folderId}' in parents and trashed = false`;
    const res = await call(`${API}?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`);
    const { files } = await res.json();
    const id = files?.[0]?.id ?? null;
    if (id) fileIds.set(name, id);
    return id;
  }

  /** Returns the file text, or null when the file does not exist yet. */
  async function readText(name) {
    const id = await findId(name);
    if (!id) return null;
    const res = await call(`${API}/${id}?alt=media&supportsAllDrives=true`);
    return res.text();
  }

  async function writeText(name, text, mime = 'application/json') {
    const id = await findId(name);
    if (id) {
      await call(`${UPLOAD}/${id}?uploadType=media&supportsAllDrives=true`, {
        method: 'PATCH',
        headers: { 'Content-Type': `${mime}; charset=utf-8` },
        body: text,
      });
      return;
    }
    const boundary = `b${now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const meta = JSON.stringify({ name, parents: [folderId], mimeType: mime });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${meta}\r\n`
      + `--${boundary}\r\nContent-Type: ${mime}; charset=utf-8\r\n\r\n${text}\r\n--${boundary}--`;
    const res = await call(`${UPLOAD}?uploadType=multipart&fields=id&supportsAllDrives=true`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    fileIds.set(name, (await res.json()).id);
  }

  return { readText, writeText };
}
