// Data layer: the document, persistence, and the undo/redo engine. What the document holds is described
// in schema.js; this file only knows it as languages > tables > rows > cells.
//
// Every change goes through a transaction made of primitive operations (set / insert / remove)
// on paths into the document. Each operation records what it needs to be reversed, so a
// transaction can be undone and redone exactly. Path segments are property names, array
// indexes, or {id} objects that find an array item by its id.
const Store = (() => {
  const KEY = 'langkit';
  const OLD_KEYS = ['langkit:v2'];  // where earlier versions saved; read once, then left alone
  const FIRST_KEY = 'langkit:v1';
  const HISTORY_LIMIT = 500;
  const COALESCE_MS = 1000;
  const uid = Schema.uid;
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function load() {
    let raw = null, db = null;
    for (const key of [KEY, ...OLD_KEYS]) {
      try { raw = localStorage.getItem(key); db = JSON.parse(raw); } catch { db = null; }
      if (db && Array.isArray(db.languages)) break;
      db = null;
    }
    if (!db) {
      db = { version: Schema.VERSION, languages: [] };
      // Carry over rows from the first version (phrase/translation) if there are any.
      try {
        const rows = JSON.parse(localStorage.getItem(FIRST_KEY))?.tables?.[0]?.rows || [];
        if (rows.length) {
          const lang = Schema.newLanguage('My language');
          lang.tables.find(t => t.id === 'phrases').rows = rows.map(r => ({ id: r.id, cells: { english: r.cells.translation || '', conlang: r.cells.phrase || '' } }));
          db.languages.push(lang);
        }
      } catch {}
      return db;
    }
    if ((Number(db.version) || 0) < Schema.VERSION) {
      // Keep the document exactly as it was before bringing it up to date.
      try { localStorage.setItem(KEY + ':before-v' + Schema.VERSION, raw); } catch {}
      Schema.migrate(db);
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    } else {
      db.languages.forEach(Schema.ensure);
    }
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

  // Everything that goes when a row is deleted, following the links declared in the schema:
  // remove: rows to delete (the rows that depend on it first, the row itself last);
  // clear: fields of surviving rows that pointed at something deleted.
  function dependents(langId, tableId, rowId) {
    const seen = new Set(), remove = [], clear = [];
    const visit = (tId, rId) => {
      const key = tId + ':' + rId;
      if (seen.has(key)) return;
      seen.add(key);
      for (const spec of Schema.TABLES) for (const [col, [target, rule]] of Object.entries(spec.refs || {})) {
        if (target !== tId) continue;
        for (const r of table(langId, spec.id)?.rows || []) {
          if (r.cells[col] !== rId) continue;
          if (rule === 'cascade') visit(spec.id, r.id); else clear.push({ table: spec.id, id: r.id, col });
        }
      }
      remove.push({ table: tId, id: rId });
    };
    visit(tableId, rowId);
    return { remove, clear: clear.filter(c => !seen.has(c.table + ':' + c.id)) };
  }

  // ---------- Edits (all undoable) ----------
  return {
    columns: (langId, tableId) => Schema.columns(tableId, language(langId)),
    columnType: Schema.columnType,
    languages: () => db.languages,
    language,
    table,
    rows: (langId, tableId) => table(langId, tableId)?.rows || [],
    row: (langId, tableId, rowId) => table(langId, tableId)?.rows.find(r => r.id === rowId),
    dependents,
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
      const lang = Schema.newLanguage(name);
      transact('Create language', () => record({ t: 'insert', path: ['languages'], value: lang }));
      return lang;
    },
    deleteLanguage(id) {
      const index = db.languages.findIndex(l => l.id === id);
      if (index >= 0) transact('Delete language', () => record({ t: 'remove', path: ['languages'], index }));
    },
    addRow(langId, tableId, cells = {}, opts = {}) {
      const row = { id: opts.id || uid(), cells };
      transact('Add row', () => record({ t: 'insert', path: [...tablePath(langId, tableId), 'rows'], index: opts.index, value: row }), opts);
      return row;
    },
    updateCell(langId, tableId, rowId, colId, value, opts = {}) {
      const path = [...tablePath(langId, tableId), 'rows', { id: rowId }, 'cells', colId];
      const row = table(langId, tableId)?.rows.find(r => r.id === rowId);
      if (!row || same(row.cells[colId], value)) return;
      transact('Edit cell', () => record({ t: 'set', path, value }), opts);
    },
    // Delete a row together with everything that depends on it (see dependents).
    deleteRow(langId, tableId, rowId, opts = {}) {
      if (!table(langId, tableId)?.rows.some(r => r.id === rowId)) return;
      const d = dependents(langId, tableId, rowId);
      transact('Delete', () => {
        for (const c of d.clear) record({ t: 'set', path: [...tablePath(langId, c.table), 'rows', { id: c.id }, 'cells', c.col], value: undefined });
        for (const x of d.remove) {
          const index = table(langId, x.table).rows.findIndex(r => r.id === x.id);
          if (index >= 0) record({ t: 'remove', path: [...tablePath(langId, x.table), 'rows'], index });
        }
      }, opts);
    },
  };
})();
