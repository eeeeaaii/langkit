// Data layer, kept in localStorage.
// Shape: { version, languages: [{ id, name, tables: [{ id, name, columns: [{id, name}], rows: [{id, cells: {colId: value}}] }] }] }
// Each language owns its tables, so later we can add columns (IPA, part of speech…) or tables (grammar, roots…).
const Store = (() => {
  const KEY = 'langkit:v2';
  const OLD_KEY = 'langkit:v1';
  const uid = () => Math.random().toString(36).slice(2, 10);

  const newLanguage = name => ({
    id: uid(),
    name,
    tables: [{
      id: 'phrases',
      name: 'Phrases',
      columns: [
        { id: 'english', name: 'English' },
        { id: 'conlang', name },
      ],
      rows: [],
    }],
  });

  function load() {
    try {
      const db = JSON.parse(localStorage.getItem(KEY));
      if (db && Array.isArray(db.languages)) return db;
    } catch {}
    const db = { version: 2, languages: [] };
    // Carry over rows from the first version (phrase/translation) if there are any.
    try {
      const old = JSON.parse(localStorage.getItem(OLD_KEY));
      const rows = old?.tables?.[0]?.rows || [];
      if (rows.length) {
        const lang = newLanguage('My language');
        lang.tables[0].rows = rows.map(r => ({ id: r.id, cells: { english: r.cells.translation || '', conlang: r.cells.phrase || '' } }));
        db.languages.push(lang);
      }
    } catch {}
    return db;
  }

  let db = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));

  const language = id => db.languages.find(l => l.id === id);
  const table = (langId, tableId = 'phrases') => language(langId)?.tables.find(t => t.id === tableId);

  return {
    languages: () => db.languages,
    language,
    table,
    createLanguage(name) {
      const lang = newLanguage(name);
      db.languages.push(lang);
      save();
      return lang;
    },
    deleteLanguage(id) {
      db.languages = db.languages.filter(l => l.id !== id);
      save();
    },
    addRow(langId, cells = {}) {
      const row = { id: uid(), cells };
      table(langId).rows.push(row);
      save();
      return row;
    },
    updateCell(langId, rowId, colId, value) {
      const row = table(langId).rows.find(r => r.id === rowId);
      if (row && row.cells[colId] !== value) { row.cells[colId] = value; save(); }
    },
    deleteRow(langId, rowId) {
      const t = table(langId);
      t.rows = t.rows.filter(r => r.id !== rowId);
      save();
    },
    exportJSON: () => JSON.stringify(db, null, 2),
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.languages)) throw new Error('Not a LangKit file');
      db = data;
      save();
    },
  };
})();
