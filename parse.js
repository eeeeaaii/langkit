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
        const symbols = [].concat(ph || []).filter(Boolean);
        if (spelling && symbols.length) list.push({ spelling, ipa: symbols.join(''), symbols });
      }
    }
    return list.sort((a, b) => b.spelling.length - a.spelling.length);
  }

  // Returns segments: { text, ipa, symbols } for a match, { text, unknown: true } for an unmatched letter,
  // or { text } for anything else (spaces, punctuation).
  function segment(text, inv) {
    const lower = text.toLowerCase();
    const out = [];
    let i = 0;
    while (i < text.length) {
      const hit = inv.find(e => lower.startsWith(e.spelling, i));
      if (hit) {
        out.push({ text: text.slice(i, i + hit.spelling.length), ipa: hit.ipa, symbols: hit.symbols });
        i += hit.spelling.length;
        continue;
      }
      const ch = String.fromCodePoint(text.codePointAt(i));
      out.push(LETTER.test(ch) ? { text: ch, unknown: true } : { text: ch });
      i += ch.length;
    }
    return out;
  }

  const rows = (lang, id) => lang.tables.find(x => x.id === id)?.rows || [];
  const trim = v => String(v ?? '').trim();

  const posName = (lang, id) => trim(rows(lang, 'partsOfSpeech').find(p => p.id === id)?.cells.name);

  // The forms of a part of speech: every value in its Inflection Types layers that has nothing under it,
  // named by the labels on the way down to it, e.g. "indicative present 1st singular". [{ id, label }]
  function inflectionForms(lang, pos) {
    if (!pos) return [];
    const values = rows(lang, 'inflectionValues');
    const out = [];
    for (const type of rows(lang, 'inflectionTypes').filter(t => t.cells.pos === pos)) {
      const mine = values.filter(v => v.cells.type === type.id);
      const kids = parent => mine.filter(v => (v.cells.parent || '') === parent);
      const walk = (node, path) => {
        const label = trim(node.cells.label);
        const here = label ? [...path, label] : path;
        const under = kids(node.id);
        if (!under.length) out.push({ id: node.id, label: here.join(' ') }); else under.forEach(k => walk(k, here));
      };
      kids('').forEach(k => walk(k, []));
    }
    return out;
  }

  // Every inflection with its model word and that word's forms, in Inflection Types order.
  // Returns [{ id, row, lex (the model's Lexicon id), key (the model word), pos, forms: [{ id, label, inflected }],
  //   legacy: [{ id (the form row), form, inflected }] }]. legacy: forms that no longer match Inflection Types.
  function inflectionSets(lang) {
    const lex = rows(lang, 'lexicon'), forms = rows(lang, 'forms');
    return rows(lang, 'inflections').map(row => {
      const entry = lex.find(r => r.id === row.cells.model);
      const pos = entry?.cells.pos || '';
      const mine = entry ? forms.filter(f => f.cells.word === entry.id) : [];
      const written = new Map(mine.filter(f => f.cells.value).map(f => [f.cells.value, trim(f.cells.text)]));
      return {
        id: row.id, row, lex: entry?.id, key: trim(entry?.cells.word), pos,
        forms: inflectionForms(lang, pos).map(f => ({ ...f, inflected: written.get(f.id) || '' })),
        legacy: mine.filter(f => !f.cells.value).map(f => ({ id: f.id, form: f.cells.label || '', inflected: f.cells.text || '' })),
      };
    });
  }

  // Inflections: every word in the Inflection tab is a model other words of its part of speech can follow.
  // Its name is the Inflection Name, or "like <word>" when none is given.
  // The model's stem is what its default form (the Word) and all its inflected forms share at the start;
  // the rest of each form is its ending. E.g. vivir / vivo / vives: stem "viv", default ending "ir", endings "o", "es".
  function patterns(lang) {
    return inflectionSets(lang).filter(g => g.key).map(g => {
      const model = g.key.toLowerCase();
      const forms = [...g.forms.map(f => ({ form: f.label, inflected: f.inflected.toLowerCase() })),
        ...g.legacy.map(f => ({ form: f.form, inflected: trim(f.inflected).toLowerCase() }))].filter(f => f.inflected);
      let stem = model;
      for (const f of forms) while (!f.inflected.startsWith(stem)) stem = stem.slice(0, -1);
      return {
        id: g.id,
        name: trim(g.row.cells.name) || 'like ' + g.key,
        model,
        pos: g.pos,
        ending: model.slice(stem.length),
        forms: forms.map(f => ({ form: f.form, ending: f.inflected.slice(stem.length) })),
      };
    });
  }

  // The forms a word gets by following a named inflection: its default ending swapped for each form's ending.
  // A word that doesn't end in the model's default ending keeps all of its letters as the stem.
  function follow(word, pattern) {
    const w = word.trim().toLowerCase();
    const stem = pattern.ending && w.endsWith(pattern.ending) ? w.slice(0, -pattern.ending.length) : w;
    return pattern.forms.map(f => ({ form: f.form, inflected: stem + f.ending }));
  }

  // The inflection a Lexicon entry follows.
  const findPattern = (list, id) => (id ? list.find(p => p.id === id) : null) || null;

  // Inflected forms mapped to their base word (both lowercased): the forms written out in the Inflection tab,
  // plus the forms of every Lexicon word that follows an inflection.
  function inflections(lang) {
    const map = new Map();
    for (const g of inflectionSets(lang)) {
      if (!g.key) continue;
      for (const f of [...g.forms, ...g.legacy]) {
        const form = (f.inflected || '').trim().toLowerCase();
        if (form && !map.has(form)) map.set(form, g.key.toLowerCase());
      }
    }
    const list = patterns(lang);
    for (const r of lang.tables.find(x => x.id === 'lexicon')?.rows || []) {
      const word = (r.cells.word || '').trim().toLowerCase();
      const p = word && findPattern(list, r.cells.inflection);
      if (p) for (const f of follow(word, p)) if (!map.has(f.inflected)) map.set(f.inflected, word);
    }
    return map;
  }

  // Every lexicon word that a written word stands for: itself, or the base word of an inflected form.
  const baseOf = (word, infl) => infl.get(word) || word;

  // Every word in the Lexicon's Word column, plus its inflected forms, lowercased.
  function lexicon(lang) {
    const t = lang.tables.find(x => x.id === 'lexicon');
    const set = new Set((t?.rows || []).map(r => (r.cells.word || '').trim().toLowerCase()).filter(Boolean));
    for (const [form, base] of inflections(lang)) if (set.has(base)) set.add(form);
    return set;
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
    for (const [form, base] of inflections(lang)) if (map.has(base) && !map.has(form)) map.set(form, map.get(base));
    return map;
  }

  // How many times each word appears where the language is written: the Phrases language column
  // and the Lexicon's In a Sentence column. Inflected forms count toward their base word. Keys are lowercased.
  function usage(lang) {
    const counts = new Map();
    const infl = inflections(lang);
    const count = text => words(text || '').forEach(w => {
      if (!w.word) return;
      const k = baseOf(w.text.toLowerCase(), infl);
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

  return { inventory, segment, posName, inflectionSets, patterns, findPattern, follow, inflections, inflectionForms, lexicon, glosses, usage, words };
})();
