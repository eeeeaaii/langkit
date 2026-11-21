// Data layer. A "table" is a list of columns plus rows keyed by column id,
// so adding columns or more tables later doesn't change the shape.
const Store = (() => {
  const KEY = 'langkit:v1';
  const uid = () => Math.random().toString(36).slice(2, 10);

  const defaults = () => ({
    version: 1,
    tables: [{
      id: 'phrases',
      name: 'Phrases',
      columns: [
        { id: 'phrase', name: 'Phrase' },
        { id: 'translation', name: 'Translation' },
      ],
      rows: [],
    }],
  });

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || defaults(); }
  catch { db = defaults(); }

  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const table = (id = 'phrases') => db.tables.find(t => t.id === id);

  return {
    table,
    addRow(tableId, cells = {}) {
      const row = { id: uid(), cells };
      table(tableId).rows.push(row);
      save();
      return row;
    },
    updateCell(tableId, rowId, colId, value) {
      const row = table(tableId).rows.find(r => r.id === rowId);
      if (row && row.cells[colId] !== value) { row.cells[colId] = value; save(); }
    },
    deleteRow(tableId, rowId) {
      const t = table(tableId);
      t.rows = t.rows.filter(r => r.id !== rowId);
      save();
    },
    exportJSON: () => JSON.stringify(db, null, 2),
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.tables)) throw new Error('Not a LangKit file');
      db = data;
      save();
    },
  };
})();
