// The shape of the data: which tables a language has, what their rows hold, how rows point at each other,
// and how documents saved by older versions are brought up to date.
//
// Document: { version, languages: [{ id, name, tables: [{ id, rows: [{ id, cells: { field: value } }] }] }] }
//
// Rules that keep this easy to extend:
//   - Every kind of thing is its own table of rows, and every row has a permanent id.
//   - Rows point at other rows by id, never by their text. Those pointers are declared in `refs`, with what
//     happens to the pointing row when its target is deleted ('cascade': delete it too, 'clear': empty the field).
//     Store.deleteRow follows them, so nothing is ever left pointing at a row that is gone.
//   - What is shown (column names, form names, the order of forms) is worked out from the rows, not stored twice.
//   - Adding a field or a table needs no migration: rows keep fields this version doesn't know about.
//   - Changing the meaning of something that is already saved: raise VERSION and add a step to MIGRATIONS.
const Schema = (() => {
  const VERSION = 4;
  const uid = () => Math.random().toString(36).slice(2, 10);

  // The parts of speech a new language starts with. They are rows like any other (partsOfSpeech).
  const POS = ['noun', 'pronoun', 'verb', 'adjective', 'adverb', 'preposition', 'postposition', 'conjunction', 'determiner', 'numeral', 'particle', 'interjection'];

  // columns: the fields shown as columns when the table is drawn as a plain grid, and how each is edited.
  // refs: { field: [table it points into, what to do when that row is deleted] }.
  const TABLES = [
    { id: 'phrases', columns: lang => [
      { id: 'english', name: 'English', type: 'text' },
      { id: 'conlang', name: lang.name, type: 'phrase' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },

    // Phonology. phoneme is always a list of IPA symbols (one for a consonant or vowel, several for a diphthong).
    { id: 'consonants', columns: () => [
      { id: 'orthography', name: 'English Orthography', type: 'text' },
      { id: 'phoneme', name: 'Phoneme', type: 'consonant' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },
    { id: 'vowels', columns: () => [
      { id: 'orthography', name: 'English Orthography', type: 'text' },
      { id: 'phoneme', name: 'Phoneme', type: 'vowel' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },
    { id: 'diphthongs', columns: () => [
      { id: 'orthography', name: 'English Orthography', type: 'text' },
      { id: 'phoneme', name: 'Phoneme', type: 'diphthong' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },

    // { name }
    { id: 'partsOfSpeech', columns: () => [{ id: 'name', name: 'Name', type: 'text' }] },

    // A word. pos: its part of speech. inflection: the inflection it follows (for a model word, its own).
    { id: 'lexicon', refs: { pos: ['partsOfSpeech', 'clear'], inflection: ['inflections', 'clear'] }, columns: () => [
      { id: 'word', name: 'Word', type: 'word' },
      { id: 'english', name: 'English', type: 'text' },
      { id: 'pos', name: 'Part of Speech', type: 'pos' },
      { id: 'traits', name: 'Traits', type: 'traits' }, // drawn from wordTraits, not a field of the row
      { id: 'inflection', name: 'Inflection', type: 'inflection' },
      { id: 'note', name: 'Note', type: 'text' },
      { id: 'sentence', name: 'In a Sentence', type: 'word' },
      { id: 'sentenceTranslation', name: 'Sentence Translation', type: 'text' },
    ] },

    // Inflection Types. A type is the set of forms a part of speech has: { pos, layerKind }.
    { id: 'inflectionTypes', refs: { pos: ['partsOfSpeech', 'cascade'] } },
    // The layers of a type, as a tree: { type, parent (another value, or '' in the first layer), label, layerKind }.
    // Rows are in display order. A layer is the list of values under one type or value, and there are two kinds.
    // layerKind says which kind the layer UNDER this row is:
    //   (nothing): an inflection layer. A word has a form for every value in it.
    //   'trait': a trait layer. A word is exactly one of its values (see wordTraits), and only what is under
    //     that value applies to the word. E.g. a noun is masculine or feminine.
    // The two kinds can alternate in any order on the way down. A value with nothing under it is one form,
    // named by the inflection labels on the way down to it: indicative > present > 1st > singular.
    { id: 'inflectionValues', refs: { type: ['inflectionTypes', 'cascade'], parent: ['inflectionValues', 'cascade'] } },

    // One trait of one word: { word, value: the value it has in some trait layer }.
    { id: 'wordTraits', refs: { word: ['lexicon', 'cascade'], value: ['inflectionValues', 'cascade'] } },

    // A named way of inflecting that words can follow: { name (optional), model: the word that shows how }.
    { id: 'inflections', refs: { model: ['lexicon', 'cascade'] } },
    // One written-out form of one word: { word, value: which form it is, text }.
    // A form whose value is '' is one that no longer matches Inflection Types; it keeps its old name in label.
    { id: 'forms', refs: { word: ['lexicon', 'cascade'], value: ['inflectionValues', 'cascade'] } },
  ];

  const spec = id => TABLES.find(t => t.id === id);
  const columns = (tableId, lang) => spec(tableId)?.columns?.(lang || { name: '' }) || [];
  const columnType = (tableId, colId) => columns(tableId).find(c => c.id === colId)?.type || 'text';
  const tableOf = (lang, id) => lang.tables.find(t => t.id === id);

  // Make sure a language has every table (tables this version doesn't know are left alone).
  function ensure(lang) {
    lang.tables ||= [];
    TABLES.forEach(s => { if (!tableOf(lang, s.id)) lang.tables.push({ id: s.id, rows: [] }); });
    return lang;
  }

  function newLanguage(name) {
    const lang = ensure({ id: uid(), name, tables: [] });
    tableOf(lang, 'partsOfSpeech').rows = POS.map(name => ({ id: uid(), cells: { name } }));
    return lang;
  }

  // ---------- Migrations ----------
  // MIGRATIONS[n] turns a version n document into version n + 1. They run in order, so a document of any age
  // ends up current. Never edit a step once it has shipped; add the next one.
  const MIGRATIONS = {
    3: db => db.languages.forEach(v3to4),
  };

  function migrate(db) {
    let v = Math.max(3, Number(db.version) || 3); // everything before 4 was saved as "3", whatever its layout
    for (; v < VERSION; v++) MIGRATIONS[v](db);
    db.version = Math.max(v, VERSION);
    db.languages.forEach(ensure);
    return db;
  }

  const text = v => String(v ?? '').trim();

  // Version 3 kept everything as spreadsheet rows: parts of speech as plain text, Inflection Types as one
  // table holding the whole tree (its top items being part of speech names), and each word's forms inside
  // its Inflection row. Version 4 gives each of those its own table and links them by id.
  function v3to4(lang) {
    lang.tables ||= [];
    v3Types(lang);
    v3Inflections(lang);
    const rowsOf = id => tableOf(lang, id)?.rows || [];

    // Parts of speech become rows; anything typed by hand becomes one too.
    const pos = POS.map(name => ({ id: uid(), cells: { name } }));
    const posId = value => {
      const name = text(Array.isArray(value) ? value[0] : value);
      if (!name) return '';
      let row = pos.find(p => p.cells.name.toLowerCase() === name.toLowerCase());
      if (!row) pos.push(row = { id: uid(), cells: { name } });
      return row.id;
    };
    const lexicon = rowsOf('lexicon');
    for (const r of lexicon) {
      const id = posId(r.cells.pos);
      if (id) r.cells.pos = id; else delete r.cells.pos;
    }

    // A phoneme is always a list of symbols.
    for (const id of ['consonants', 'vowels', 'diphthongs']) for (const r of rowsOf(id)) {
      const p = [].concat(r.cells.phoneme || []).filter(Boolean);
      if (p.length) r.cells.phoneme = p; else delete r.cells.phoneme;
    }

    // The tree splits into types (its top items) and values (everything under them).
    const old = rowsOf('inflectionTypes');
    const byId = new Map(old.map(r => [r.id, r]));
    const rootOf = r => {
      const seen = new Set();
      while (r && r.cells.parent) { if (seen.has(r.id)) return null; seen.add(r.id); r = byId.get(r.cells.parent); }
      return r || null;
    };
    const types = [], values = [];
    for (const r of old) {
      if (!r.cells.parent) { types.push({ id: r.id, cells: { pos: posId(r.cells.label) } }); continue; }
      const root = rootOf(r);
      if (root) values.push({ id: r.id, cells: { type: root.id, parent: r.cells.parent === root.id ? '' : r.cells.parent, label: r.cells.label || '' } });
    }

    // Each Inflection row becomes an inflection (its name and model word) plus one row per form.
    const valueIds = new Set(values.map(v => v.id));
    const inflections = [], forms = [], byName = new Map(), taken = new Set();
    for (const r of rowsOf('inflections')) {
      const c = r.cells;
      const entry = lexicon.find(e => e.id === c.lex) ||
        (text(c.word) ? lexicon.find(e => text(e.cells.word).toLowerCase() === text(c.word).toLowerCase()) : null);
      if (!entry) continue; // its word was deleted from the Lexicon
      const cells = { model: entry.id };
      if (text(c.pattern)) cells.name = c.pattern;
      inflections.push({ id: r.id, cells });
      const name = (text(c.pattern) || 'like ' + text(entry.cells.word)).toLowerCase();
      if (!byName.has(name)) byName.set(name, r.id);
      for (const [value, written] of Object.entries(c.forms || {})) {
        if (!text(written)) continue;
        const known = valueIds.has(value) && !taken.has(entry.id + ':' + value);
        if (known) taken.add(entry.id + ':' + value);
        forms.push({ id: uid(), cells: known ? { word: entry.id, value, text: written } : { word: entry.id, value: '', label: '', text: written } });
      }
      for (const f of c.legacy || []) {
        if (text(f.form) || text(f.inflected)) forms.push({ id: uid(), cells: { word: entry.id, value: '', label: f.form || '', text: f.inflected || '' } });
      }
    }

    // Lexicon entries name the inflection they follow by id (very old ones used its name).
    const ids = new Set(inflections.map(i => i.id));
    for (const r of lexicon) {
      const v = r.cells.inflection;
      if (v == null || v === '') continue;
      const id = ids.has(v) ? v : byName.get(String(v).toLowerCase());
      if (id) r.cells.inflection = id; else delete r.cells.inflection;
    }

    const put = (id, rows) => { let t = tableOf(lang, id); if (!t) lang.tables.push(t = { id, rows: [] }); t.rows = rows; };
    put('partsOfSpeech', pos);
    put('inflectionTypes', types);
    put('inflectionValues', values);
    put('inflections', inflections);
    put('forms', forms);
    // Column names and table titles come from this file now.
    for (const t of lang.tables) { delete t.name; delete t.columns; t.rows ||= []; }
  }

  // Layouts older than the tree, all saved as version 3.
  // Inflection Types as rows of part of speech + form: make each part of speech an item with its forms under it.
  function v3Types(lang) {
    const t = tableOf(lang, 'inflectionTypes');
    if (!t || !t.rows.some(r => 'pos' in r.cells || 'form' in r.cells)) return;
    const rows = [];
    let root = null;
    for (const r of t.rows) {
      const pos = text(Array.isArray(r.cells.pos) ? r.cells.pos[0] : r.cells.pos);
      if (pos) { root = { id: r.id, cells: { parent: '', label: pos } }; rows.push(root); }
      const form = text(r.cells.form);
      if (form && root) rows.push({ id: uid(), cells: { parent: root.id, label: form } });
    }
    t.rows = rows;
  }
  // Inflections as rows of word + form name + inflected form: make each word one row holding its forms,
  // matched to the Inflection Types tree by name. Forms that match nothing are kept under legacy.
  function v3Inflections(lang) {
    const t = tableOf(lang, 'inflections');
    if (!t || !t.rows.some(r => 'form' in r.cells || 'inflected' in r.cells)) return;
    const lexicon = tableOf(lang, 'lexicon')?.rows || [];
    const tree = tableOf(lang, 'inflectionTypes')?.rows || [];
    const kids = id => tree.filter(r => (r.cells.parent || '') === id);
    const leaves = pos => {
      const out = [];
      const walk = (node, path) => {
        const here = text(node.cells.label) ? [...path, text(node.cells.label)] : path;
        const under = kids(node.id);
        if (!under.length) out.push({ id: node.id, label: here.join(' ') }); else under.forEach(k => walk(k, here));
      };
      kids('').filter(r => text(r.cells.label).toLowerCase() === text(pos).toLowerCase()).forEach(root => kids(root.id).forEach(k => walk(k, [])));
      return out;
    };
    const out = [];
    let cur = null;
    for (const r of t.rows) {
      const c = r.cells;
      if (c.lex || text(c.word)) {
        const entry = lexicon.find(e => e.id === c.lex) || lexicon.find(e => text(e.cells.word).toLowerCase() === text(c.word).toLowerCase());
        cur = { row: { id: r.id, cells: { word: c.word || '', forms: {} } }, leaves: leaves([].concat(entry?.cells.pos || [])[0]) };
        if (c.lex) cur.row.cells.lex = c.lex;
        if (c.pattern) cur.row.cells.pattern = c.pattern;
        out.push(cur.row);
      }
      if (!cur) continue;
      const form = text(c.form), inflected = text(c.inflected);
      if (!inflected) continue;
      const leaf = cur.leaves.find(l => l.label.toLowerCase() === form.toLowerCase());
      if (leaf && !cur.row.cells.forms[leaf.id]) cur.row.cells.forms[leaf.id] = inflected;
      else (cur.row.cells.legacy ||= []).push({ form, inflected });
    }
    t.rows = out;
  }

  return { VERSION, TABLES, POS, spec, columns, columnType, ensure, newLanguage, migrate, uid };
})();
