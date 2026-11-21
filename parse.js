// Word parsing: split typed text into phonemes using the language's phonology tables.
// Matching is greedy (longest spelling first) and ignores case. Letters that no spelling
// covers come back as unknown; spaces and punctuation are left alone.
const Parse = (() => {
  const LETTER = /[\p{L}\p{M}]/u;

  // All spellings defined in Consonants, Vowels and Diphthongs that have a phoneme chosen.
  function inventory(lang) {
    const list = [];
    for (const tableId of ['consonants', 'vowels', 'diphthongs']) {
      const t = lang.tables.find(x => x.id === tableId);
      for (const row of t?.rows || []) {
        const spelling = (row.cells.orthography || '').trim().toLowerCase();
        const ph = row.cells.phoneme;
        const ipa = Array.isArray(ph) ? ph.join('') : ph;
        if (spelling && ipa) list.push({ spelling, ipa });
      }
    }
    return list.sort((a, b) => b.spelling.length - a.spelling.length);
  }

  // Returns segments: { text, ipa } for a match, { text, unknown: true } for an unmatched letter,
  // or { text } for anything else (spaces, punctuation).
  function segment(text, inv) {
    const lower = text.toLowerCase();
    const out = [];
    let i = 0;
    while (i < text.length) {
      const hit = inv.find(e => lower.startsWith(e.spelling, i));
      if (hit) {
        out.push({ text: text.slice(i, i + hit.spelling.length), ipa: hit.ipa });
        i += hit.spelling.length;
        continue;
      }
      const ch = String.fromCodePoint(text.codePointAt(i));
      out.push(LETTER.test(ch) ? { text: ch, unknown: true } : { text: ch });
      i += ch.length;
    }
    return out;
  }

  return { inventory, segment };
})();
