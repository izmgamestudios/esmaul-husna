// Validates external source links before they are served to the UI.
// Only https links are accepted, which blocks javascript: and other unsafe schemes.

export function validateSources(list) {
  if (!Array.isArray(list)) throw new Error('sources.json bir dizi olmalı');
  return list.map((s, i) => {
    const { category, title, url, note } = s ?? {};
    if (![category, title, note].every((v) => typeof v === 'string' && v.trim())) {
      throw new Error(`Kaynak #${i}: category, title ve note zorunlu`);
    }
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error(`Kaynak #${i}: geçersiz URL`); }
    if (parsed.protocol !== 'https:') throw new Error(`Kaynak #${i}: yalnızca https izinli`);
    return { category, title, url: parsed.href, note };
  });
}
