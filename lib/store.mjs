// Storage backends. Both expose the same async interface so the server does not care where data lives:
//   loadProgress() -> { completed, freezes } | null     saveProgress(progress)
//   appendActivity(row)                                  saveReport(report)
// "file": local JSON files under data/.  "drive": files inside one Google Drive folder.
import { readFile, writeFile, rename, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { createDriveClient } from './drive.mjs';

export const PROGRESS_FILE = 'progress.json';
export const ACTIVITY_FILE = 'activity.csv';
export const REPORT_FILE = 'summary.json';
const ACTIVITY_HEADER = 'timestamp,date,name,action\n';

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export const activityLine = ({ timestamp, date, name, action }) =>
  `${[timestamp, date, name, action].map(csvCell).join(',')}\n`;

export function createFileStore(dir) {
  const file = (n) => path.join(dir, n);
  const writeAtomic = async (name, text) => {
    await mkdir(dir, { recursive: true });
    const tmp = `${file(name)}.tmp`;
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, file(name));
  };
  return {
    kind: 'file',
    async loadProgress() {
      try { return JSON.parse(await readFile(file(PROGRESS_FILE), 'utf8')); } catch { return null; }
    },
    saveProgress: (progress) => writeAtomic(PROGRESS_FILE, JSON.stringify(progress, null, 2)),
    async appendActivity(row) {
      await mkdir(dir, { recursive: true });
      let exists = true;
      try { await readFile(file(ACTIVITY_FILE)); } catch { exists = false; }
      await appendFile(file(ACTIVITY_FILE), (exists ? '' : ACTIVITY_HEADER) + activityLine(row), 'utf8');
    },
    saveReport: (report) => writeAtomic(REPORT_FILE, JSON.stringify(report, null, 2)),
  };
}

export function createDriveStore(client) {
  return {
    kind: 'drive',
    async loadProgress() {
      const text = await client.readText(PROGRESS_FILE);
      if (text === null) return null;
      return JSON.parse(text); // a corrupt file must fail loudly instead of silently resetting progress
    },
    saveProgress: (progress) => client.writeText(PROGRESS_FILE, JSON.stringify(progress, null, 2)),
    async appendActivity(row) {
      const current = (await client.readText(ACTIVITY_FILE)) ?? ACTIVITY_HEADER;
      await client.writeText(ACTIVITY_FILE, current + activityLine(row), 'text/csv');
    },
    saveReport: (report) => client.writeText(REPORT_FILE, JSON.stringify(report, null, 2)),
  };
}

/** STORAGE=drive needs DRIVE_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_FILE (path to the key JSON). */
export async function createStoreFromEnv(env, dataDir) {
  if (env.STORAGE !== 'drive') return createFileStore(dataDir);
  const credentials = JSON.parse(await readFile(env.GOOGLE_SERVICE_ACCOUNT_FILE, 'utf8'));
  return createDriveStore(createDriveClient({ credentials, folderId: env.DRIVE_FOLDER_ID }));
}
