// Edits that touch more than one table: the things a person does to inflections and their types.
// Each is one undoable step. (Deleting needs nothing here: Store.deleteRow follows the schema's links.)
const Model = (() => {
  const TYPES = 'inflectionTypes', VALUES = 'inflectionValues', FORMS = 'forms', INFL = 'inflections';
  const rows = Store.rows;
  const filled = f => String(f.cells.text ?? '').trim() !== '';

  // The values directly under a type (parent '') or under another value.
  const valuesUnder = (langId, type, parent) => rows(langId, VALUES).filter(v => v.cells.type === type && (v.cells.parent || '') === (parent || ''));

  // A form belongs to a value with nothing under it. When such a value gets a layer, what was written for
  // it moves to the first value of the new layer, so nothing typed is lost.
  const moveForms = (langId, from, to) => rows(langId, FORMS).filter(f => f.cells.value === from)
    .forEach(f => Store.updateCell(langId, FORMS, f.id, 'value', to));

  function addType(langId, pos) {
    const id = Schema.uid();
    Store.addRow(langId, TYPES, { pos }, { id, meta: { focus: { table: TYPES, row: id, col: 'pos' } } });
    return id;
  }

  // Add a value to the list under a type (parent '') or under another value.
  function addValue(langId, type, parent, label) {
    const id = Schema.uid();
    const startsLayer = parent && !valuesUnder(langId, type, parent).length;
    Store.transact('Add', () => {
      Store.addRow(langId, VALUES, { type, parent: parent || '', label }, { id });
      if (startsLayer) moveForms(langId, parent, id);
    }, { coalesce: `${TYPES}:${id}:label`, meta: { focus: { table: TYPES, row: id, col: 'label' } } });
    return id;
  }

  // Give one value a copy of everything under another.
  function copyLayers(langId, from, to) {
    const type = Store.row(langId, VALUES, to)?.cells.type;
    Store.transact('Copy layers', () => {
      let first = null;
      const copy = (src, dst) => valuesUnder(langId, type, src).forEach(k => {
        const id = Schema.uid();
        Store.addRow(langId, VALUES, { type, parent: dst, label: k.cells.label || '' }, { id });
        if (valuesUnder(langId, type, k.id).length) copy(k.id, id); else first ||= id;
      });
      copy(from, to);
      if (first) moveForms(langId, to, first);
    }, { meta: { focus: { table: TYPES, row: to, col: 'label' } } });
  }

  // How many written-out forms deleting this row would take with it.
  const formsLostBy = (langId, tableId, rowId) => Store.dependents(langId, tableId, rowId).remove
    .filter(x => x.table === FORMS && filled(Store.row(langId, FORMS, x.id))).length;

  // Write one form of a word. Clearing it removes the row.
  function setForm(langId, word, value, text, opts = {}) {
    const row = rows(langId, FORMS).find(f => f.cells.word === word && f.cells.value === value);
    if (!row) { if (text !== '') Store.addRow(langId, FORMS, { word, value, text }, opts); return; }
    if (text === '') Store.deleteRow(langId, FORMS, row.id, opts);
    else Store.updateCell(langId, FORMS, row.id, 'text', text, opts);
  }

  // A new inflection modelled by a Lexicon word, which then follows it.
  function addInflection(langId, lexId, opts = {}) {
    const id = Schema.uid();
    Store.transact('New inflection', () => {
      Store.addRow(langId, INFL, { model: lexId }, { id });
      Store.updateCell(langId, 'lexicon', lexId, 'inflection', id);
    }, opts.meta ? { meta: opts.meta(id) } : {});
    return id;
  }

  // Remove an inflection and what was written out for its model word. Words that followed it follow nothing.
  function removeInflection(langId, id) {
    const model = Store.row(langId, INFL, id)?.cells.model;
    Store.transact('Delete', () => {
      rows(langId, FORMS).filter(f => f.cells.word === model).forEach(f => Store.deleteRow(langId, FORMS, f.id));
      Store.deleteRow(langId, INFL, id);
    });
  }

  return { valuesUnder, addType, addValue, copyLayers, formsLostBy, setForm, addInflection, removeInflection };
})();
