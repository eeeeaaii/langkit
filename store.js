// Data layer: the document, persistence, and the undo/redo engine.
//
// Document shape (saved in localStorage):
//   { version, languages: [{ id, name, tables: [{ id, name, columns: [{id, name}], rows: [{id, cells: {colId: value}}] }] }] }
//
// Every change goes through a transaction made of primitive operations (set / insert / remove)
// on paths into the document. Each operation records what it needs to be reversed, so a
// transaction can be undone and redone exactly. Path segments are property names, array
// indexes, or {id} objects that find an array item by its id.
const Store = (() => {
  const KEY = 'langkit:v2';
  const OLD_KEY = 'langkit:v1';
  const HISTORY_LIMIT = 500;
  const COALESCE_MS = 1000;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ---------- Schema ----------
  // Tables every language has, with their columns. Column types tell the UI how to edit a cell.
  const SCHEMA = [
    { id: 'phrases', name: 'Phrases', columns: lang => [
      { id: 'english', name: 'English', type: 'text' },
      { id: 'conlang', name: lang.name, type: 'phrase' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },
    { id: 'consonants', name: 'Consonants', columns: () => [
      { id: 'orthography', name: 'English Orthography', type: 'text' },
      { id: 'phoneme', name: 'Phoneme', type: 'consonant' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },
    { id: 'vowels', name: 'Vowels', columns: () => [
      { id: 'orthography', name: 'English Orthography', type: 'text' },
      { id: 'phoneme', name: 'Phoneme', type: 'vowel' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },
    { id: 'lexicon', name: 'Lexicon', columns: () => [
      { id: 'word', name: 'Word', type: 'word' },
      { id: 'english', name: 'English', type: 'text' },
      { id: 'pos', name: 'Part of Speech', type: 'pos' },
      { id: 'note', name: 'Note', type: 'text' },
      { id: 'sentence', name: 'In a Sentence', type: 'word' },
      { id: 'sentenceTranslation', name: 'Sentence Translation', type: 'text' },
    ] },
    { id: 'diphthongs', name: 'Diphthongs', columns: () => [
      { id: 'orthography', name: 'English Orthography', type: 'text' },
      { id: 'phoneme', name: 'Phoneme', type: 'diphthong' },
      { id: 'notes', name: 'Notes', type: 'text' },
    ] },
  ];

  const columnType = (tableId, colId) => {
    const t = SCHEMA.find(s => s.id === tableId);
    return t?.columns({ name: '' }).find(c => c.id === colId)?.type || 'text';
  };

  // Bring a language up to the current schema: add missing tables and columns, keep everything else.
  function normalize(lang) {
    SCHEMA.forEach((spec, ti) => {
      let t = lang.tables.find(x => x.id === spec.id);
      if (!t) { t = { id: spec.id, name: spec.name, columns: [], rows: [] }; lang.tables.splice(ti, 0, t); }
      spec.columns(lang).forEach((col, ci) => {
        if (!t.columns.some(c => c.id === col.id)) t.columns.splice(ci, 0, { id: col.id, name: col.name });
      });
    });
    return lang;
  }

  const newLanguage = name => normalize({ id: uid(), name, tables: [] });

  function load() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
    if (!db || !Array.isArray(db.languages)) {
      db = { version: 3, languages: [] };
      // Carry over rows from the first version (phrase/translation) if there are any.
      try {
        const rows = JSON.parse(localStorage.getItem(OLD_KEY))?.tables?.[0]?.rows || [];
        if (rows.length) {
          const lang = newLanguage('My language');
          lang.tables[0].rows = rows.map(r => ({ id: r.id, cells: { english: r.cells.translation || '', conlang: r.cells.phrase || '' } }));
          db.languages.push(lang);
        }
      } catch {}
    }
    db.version = 3;
    db.languages.forEach(normalize);
    return db;
  }

  let db = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };

  // ---------- Paths and primitive operations ----------
  function step(obj, seg) {
    if (seg && typeof seg === 'object') return obj.find(x => x.id === seg.id);
    return obj[seg];
  }
  function resolve(path) {
    let obj = db;
    for (const seg of path) {
      obj = step(obj, seg);
      if (obj === undefined) throw new Error('Path not found: ' + JSON.stringify(path));
    }
    return obj;
  }
  // Returns [container, key] for the last segment, with {id} segments turned into indexes.
  function locate(path) {
    const parent = resolve(path.slice(0, -1));
    let key = path[path.length - 1];
    if (key && typeof key === 'object') key = parent.findIndex(x => x.id === key.id);
    return [parent, key];
  }

  // Apply one operation and return its inverse.
  function apply(op) {
    if (op.t === 'set') {
      const [parent, key] = locate(op.path);
      const old = clone(parent[key]);
      if (op.value === undefined) delete parent[key]; else parent[key] = clone(op.value);
      return { t: 'set', path: op.path, value: old };
    }
    const arr = resolve(op.path);
    if (op.t === 'insert') {
      const index = op.index ?? arr.length;
      arr.splice(index, 0, clone(op.value));
      return { t: 'remove', path: op.path, index };
    }
    if (op.t === 'remove') {
      const [removed] = arr.splice(op.index, 1);
      return { t: 'insert', path: op.path, index: op.index, value: removed };
    }
    throw new Error('Unknown operation ' + op.t);
  }

  // ---------- Transactions and history ----------
  const undoStack = [], redoStack = [];
  const listeners = new Set();
  let current = null;           // the open transaction, if any
  let viewProvider = () => null; // the UI tells us what is on screen, so undo can bring it back
  let lastCoalesce = null;

  const emit = e => listeners.forEach(fn => fn(e));

  // Run fn as one undoable step. Nested calls join the outer transaction.
  // opts.coalesce: a key; consecutive transactions with the same key within COALESCE_MS merge
  //   into one undo step (used for typing in a cell).
  // opts.silent: the UI already shows the change (e.g. the text the person just typed).
  // opts.meta: anything the UI wants back in the change event.
  function transact(label, fn, opts = {}) {
    if (current) return fn();
    current = { label, ops: [], inverses: [], viewBefore: viewProvider(), time: Date.now(), coalesce: opts.coalesce || null };
    let result;
    try {
      result = fn();
    } catch (err) {
      for (let i = current.inverses.length - 1; i >= 0; i--) apply(current.inverses[i]);
      current = null;
      throw err;
    }
    const tx = current;
    current = null;
    if (!tx.ops.length) return result;
    tx.viewAfter = viewProvider();

    const top = undoStack[undoStack.length - 1];
    if (tx.coalesce && top && lastCoalesce === tx.coalesce && tx.time - top.lastTime < COALESCE_MS) {
      top.ops.push(...tx.ops);
      top.inverses.push(...tx.inverses);
      top.lastTime = tx.time;
      top.viewAfter = tx.viewAfter;
    } else {
      tx.lastTime = tx.time;
      undoStack.push(tx);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }
    lastCoalesce = tx.coalesce;
    redoStack.length = 0;
    save();
    emit({ kind: 'do', label, silent: !!opts.silent, meta: opts.meta });
    return result;
  }

  function record(op) {
    if (!current) return transact('Edit', () => record(op));
    const inverse = apply(op);
    current.ops.push(op);
    current.inverses.push(inverse);
  }

  function undo() {
    lastCoalesce = null;
    const tx = undoStack.pop();
    if (!tx) return false;
    for (let i = tx.inverses.length - 1; i >= 0; i--) apply(tx.inverses[i]);
    redoStack.push(tx);
    save();
    emit({ kind: 'undo', label: tx.label, view: tx.viewBefore });
    return true;
  }

  function redo() {
    lastCoalesce = null;
    const tx = redoStack.pop();
    if (!tx) return false;
    // Re-apply the original operations, refreshing their inverses as we go.
    tx.inverses = tx.ops.map(apply);
    undoStack.push(tx);
    save();
    emit({ kind: 'redo', label: tx.label, view: tx.viewAfter });
    return true;
  }

  // ---------- Queries ----------
  const language = id => db.languages.find(l => l.id === id);
  const table = (langId, tableId) => language(langId)?.tables.find(t => t.id === tableId);
  const tablePath = (langId, tableId) => ['languages', { id: langId }, 'tables', { id: tableId }];

  // ---------- Edits (all undoable) ----------
  return {
    SCHEMA,
    columnType,
    languages: () => db.languages,
    language,
    table,
    transact,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    breakCoalescing: () => { lastCoalesce = null; },
    coalesceKey: () => lastCoalesce,
    setViewProvider: fn => { viewProvider = fn; },
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },

    createLanguage(name) {
      const lang = newLanguage(name);
      transact('Create language', () => record({ t: 'insert', path: ['languages'], value: lang }));
      return lang;
    },
    deleteLanguage(id) {
      const index = db.languages.findIndex(l => l.id === id);
      if (index >= 0) transact('Delete language', () => record({ t: 'remove', path: ['languages'], index }));
    },
    addRow(langId, tableId, cells = {}, opts = {}) {
      const row = { id: opts.id || uid(), cells };
      transact('Add row', () => record({ t: 'insert', path: [...tablePath(langId, tableId), 'rows'], value: row }), opts);
      return row;
    },
    updateCell(langId, tableId, rowId, colId, value, opts = {}) {
      const path = [...tablePath(langId, tableId), 'rows', { id: rowId }, 'cells', colId];
      const row = table(langId, tableId)?.rows.find(r => r.id === rowId);
      if (!row || same(row.cells[colId], value)) return;
      transact('Edit cell', () => record({ t: 'set', path, value }), opts);
    },
    deleteRow(langId, tableId, rowId) {
      const index = table(langId, tableId).rows.findIndex(r => r.id === rowId);
      if (index >= 0) transact('Delete row', () => record({ t: 'remove', path: [...tablePath(langId, tableId), 'rows'], index }));
    },
  };
})();
