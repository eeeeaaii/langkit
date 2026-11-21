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

  // Every word in the Lexicon's Word column, lowercased.
  function lexicon(lang) {
    const t = lang.tables.find(x => x.id === 'lexicon');
    return new Set((t?.rows || []).map(r => (r.cells.word || '').trim().toLowerCase()).filter(Boolean));
  }

  // Every lexicon word mapped to its literal English: the first definition (before a comma),
  // cut at the first character that isn't a letter, apostrophe, space or hyphen.
  // So "doorway, portal" gives "doorway" and "door+ ugh way, portal" gives "door".
  function glosses(lang) {
    const t = lang.tables.find(x => x.id === 'lexicon');
    const map = new Map();
    for (const r of t?.rows || []) {
      const word = (r.cells.word || '').trim().toLowerCase();
      const gloss = ((r.cells.english || '').split(',')[0].match(/^[A-Za-z' -]*/)[0]).trim();
      if (word && gloss && !map.has(word)) map.set(word, gloss);
    }
    return map;
  }

  // How many times each word appears where the language is written: the Phrases language column
  // and the Lexicon's In a Sentence column. Keys are lowercased.
  function usage(lang) {
    const counts = new Map();
    const count = text => words(text || '').forEach(w => {
      if (!w.word) return;
      const k = w.text.toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    lang.tables.find(x => x.id === 'phrases')?.rows.forEach(r => count(r.cells.conlang));
    lang.tables.find(x => x.id === 'lexicon')?.rows.forEach(r => count(r.cells.sentence));
    return counts;
  }

  // Split text into words and the separators between them. Apostrophes and hyphens stay inside words.
  const SEPARATOR = /([\s.,!?;:"“”()\[\]{}…«»¿¡]+)/u;
  function words(text) {
    return text.split(SEPARATOR).filter(s => s !== '').map(s => ({ text: s, word: !SEPARATOR.test(s) }));
  }

  return { inventory, segment, lexicon, glosses, usage, words };
})();
