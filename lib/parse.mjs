// Parses data/kilavuz.md into structured name and badge records.
// Pure functions: no I/O, so they are easy to unit test.

function cells(line) {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

function isSeparator(cs) {
  return cs.every((c) => /^:?-+:?$/.test(c));
}

/** Section 4 ("## 4.") holds one markdown table per letter ("### A", ...). */
export function parseKilavuz(md) {
  const names = [];
  let inSection = false;
  let letter = null;

  for (const raw of md.split(/\r?\n/)) {
    if (/^## 4\./.test(raw)) { inSection = true; continue; }
    if (/^## /.test(raw)) { inSection = false; continue; }
    if (!inSection) continue;

    const heading = raw.match(/^### (.+)$/);
    if (heading) { letter = heading[1].trim(); continue; }
    if (!raw.startsWith('|')) continue;

    const cs = cells(raw);
    if (cs.length !== 4 || isSeparator(cs) || cs[0] === 'İsim') continue;
    names.push({ name: cs[0], arabic: cs[1], meaning: cs[2], task: cs[3], letter });
  }
  return names;
}

/** Section 3.3 ("### 3.3") holds the badge table: Rozet | Kategori | İsimler. */
export function parseBadges(md) {
  const badges = [];
  let inSection = false;

  for (const raw of md.split(/\r?\n/)) {
    if (/^### 3\.3/.test(raw)) { inSection = true; continue; }
    if (/^#{1,3} /.test(raw)) { inSection = false; continue; }
    if (!inSection || !raw.startsWith('|')) continue;

    const cs = cells(raw);
    if (cs.length !== 3 || isSeparator(cs) || cs[0] === 'Rozet') continue;
    badges.push({
      name: cs[0],
      category: cs[1],
      names: cs[2].split(',').map((s) => s.trim()).filter(Boolean),
    });
  }
  return badges;
}

/** Section 3.5 ("### 3.5") holds the weekly themes: Hafta | Tema | Odak Kategori. */
export function parseThemes(md) {
  const themes = [];
  let inSection = false;

  for (const raw of md.split(/\r?\n/)) {
    if (/^### 3\.5/.test(raw)) { inSection = true; continue; }
    if (/^#{1,3} /.test(raw)) { inSection = false; continue; }
    if (!inSection || !raw.startsWith('|')) continue;

    const cs = cells(raw);
    if (cs.length !== 3 || isSeparator(cs) || cs[0] === 'Hafta') continue;
    themes.push({
      week: Number(cs[0]),
      title: cs[1],
      badges: cs[2].split('+').map((s) => s.trim()).filter(Boolean),
    });
  }
  return themes;
}
