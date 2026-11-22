// Renders one table as an editable grid. There is always an empty row at the bottom;
// typing in it (or choosing a phoneme in it) creates a new entry.
const Sheet = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const newId = () => Math.random().toString(36).slice(2, 10);

  // Paint a word cell's overlay: letters with no phoneme are marked, and (for phrases)
  // whole words that are not in the lexicon.
  // Consecutive letters with no phoneme share one span, so they get one continuous line.
  const letters = (text, inventory) => {
    let html = '', run = '';
    const flush = () => { if (run) html += `<span class="unknown">${esc(run)}</span>`; run = ''; };
    for (const s of Parse.segment(text, inventory)) {
      if (s.unknown) { run += s.text; continue; }
      flush();
      html += esc(s.text);
    }
    flush();
    return html;
  };
  // How each target-language column is shown: 'text' (as typed), 'ipa' or 'literal'.
  // Kept per table and column for this visit; the cell being edited always shows the typed text.
  const views = new Map();
  const VIEWS = [['text', 'Text', 'Show the words as written'], ['ipa', 'IPA', 'Show the words in IPA'], ['literal', 'Literal', 'Show each word\'s English equivalent']];
  const viewOf = (tableId, colId) => views.get(tableId + ':' + colId) || 'text';

  // IPA: each spelling replaced by its phoneme; letters with no phoneme stay as typed and marked.
  // Each phoneme is its own span (spaced apart a little) that plays its sound when clicked.
  const ipa = (text, inventory) => {
    let html = '', run = '';
    const flush = () => { if (run) html += `<span class="unknown">${esc(run)}</span>`; run = ''; };
    for (const s of Parse.segment(text, inventory)) {
      if (s.unknown) { run += s.text; continue; }
      flush();
      html += s.ipa ? `<span class="ipa-sym" data-sym="${esc(s.symbols.join(' '))}" title="Click to hear">${esc(s.ipa)}</span>` : esc(s.text);
    }
    flush();
    return html;
  };
  // Literal: each word replaced by its English from the lexicon; words not in the lexicon stay as typed and marked.
  const literal = (text, glosses) => Parse.words(text).map(w => {
    if (!w.word) return esc(w.text);
    const g = glosses.get(w.text.toLowerCase());
    return g ? esc(g) : `<span class="missing" title="Not in the lexicon">${esc(w.text)}</span>`;
  }).join('');

  function paintWord(overlay, text, ctx, checkLexicon, view = 'text') {
    if (view === 'ipa') { overlay.innerHTML = text.trim() ? '/' + ipa(text, ctx.inventory()) + '/' : ''; return; }
    if (view === 'literal') { overlay.innerHTML = literal(text, ctx.glosses()); return; }
    const inventory = ctx.inventory();
    if (!checkLexicon) { overlay.innerHTML = letters(text, inventory); return; }
    const lexicon = ctx.lexicon();
    overlay.innerHTML = Parse.words(text).map(w => {
      if (!w.word) return esc(w.text);
      const html = letters(w.text, inventory);
      return lexicon.has(w.text.toLowerCase()) ? html : `<span class="missing" title="Not in the lexicon">${html}</span>`;
    }).join('');
  }

  // Lexicon Word cells: a small circle with how many times the word is used elsewhere.
  function paintUsage(wrap, text, ctx) {
    const badge = wrap.querySelector('.usage');
    if (!badge) return;
    const word = text.trim().toLowerCase();
    const n = word ? ctx.usage().get(word) || 0 : 0;
    badge.hidden = !word;
    badge.textContent = n;
    badge.title = `Used ${n} time${n === 1 ? '' : 's'} in Phrases and In a Sentence`;
  }

  function render(container, langId, tableId, ctx) {
    if (tableId === 'inflectionTypes') return renderLayers(container, langId, ctx);
    if (tableId === 'inflections') return renderInflections(container, langId, ctx);
    const t = { id: tableId, columns: Store.columns(langId, tableId), rows: Store.rows(langId, tableId) };
    const table = document.createElement('table');
    table.className = 'grid';
    table.dataset.table = tableId;
    table.innerHTML = '<thead><tr><th class="num">#</th>' +
      t.columns.map(c => `<th data-col="${c.id}">${esc(c.name)}${viewToggle(tableId, c.id)}</th>`).join('') + '<th class="act"></th></tr></thead>';
    bindToggles(table, tableId, ctx);
    const tbody = document.createElement('tbody');
    t.rows.forEach((row, i) => tbody.appendChild(rowEl(langId, t, row, i + 1, ctx)));
    tbody.appendChild(rowEl(langId, t, null, t.rows.length + 1, ctx));
    table.appendChild(tbody);
    container.replaceChildren(table);
  }

  function bindToggles(table, tableId, ctx) {
    table.querySelectorAll('.view-toggle button').forEach(b => b.onclick = () => {
      const th = b.closest('th');
      views.set(tableId + ':' + th.dataset.col, b.dataset.view);
      th.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      repaintWords(table, ctx);
    });
  }

  // Inflection tab: a block per word. The word (from its Lexicon entry) and its Inflection Name span the block;
  // there is a row per form of its part of speech, named and ordered by Inflection Types, holding the inflected
  // form. Each written form is its own row in the forms table, pointing at its word and at the Inflection Types
  // value it is, so renaming, adding or removing layers there shows up here for every word.
  function renderInflections(container, langId, ctx) {
    const T = 'inflections';
    const t = { id: T };
    const sets = Parse.inflectionSets(Store.language(langId));
    const table = document.createElement('table');
    table.className = 'grid';
    table.dataset.table = T;
    table.innerHTML = `<thead><tr><th class="num">#</th><th data-col="word">Word${viewToggle(T, 'word')}</th><th data-col="name">Inflection Name</th>` +
      `<th data-col="form">Form</th><th data-col="inflected">Inflected Form${viewToggle(T, 'inflected')}</th><th class="act"></th></tr></thead>`;
    bindToggles(table, T, ctx);
    const tbody = document.createElement('tbody');
    const td = (cls, span) => { const c = document.createElement('td'); if (cls) c.className = cls; if (span > 1) c.rowSpan = span; return c; };
    sets.forEach((set, n) => {
      const lines = [
        ...set.forms.map(f => ({ key: f.id, label: f.label, value: f.inflected })),
        ...set.legacy.map(f => ({ legacy: f.id, label: f.form, value: f.inflected })),
      ];
      const span = Math.max(1, lines.length);
      const first = document.createElement('tr');
      first.className = 'group-start';
      first.dataset.row = set.id;
      const num = td('num', span); num.textContent = n + 1; first.appendChild(num);
      const word = td('c-word group-head', span);
      word.appendChild(textCell(t, set.row, { id: 'word', name: 'Word' }, set.key, 'word', () => {}, ctx, true));
      first.appendChild(word);
      const name = td('c-text group-head', span);
      name.appendChild(textCell(t, set.row, { id: 'name', name: 'Inflection Name' }, set.row.cells.name, 'text',
        (c, v, o) => Store.updateCell(langId, T, set.id, 'name', v, o), ctx));
      first.appendChild(name);
      const del = document.createElement('button');
      del.className = 'del';
      del.title = 'Remove this word\'s inflection';
      del.setAttribute('aria-label', del.title);
      del.tabIndex = -1;
      del.innerHTML = TRASH;
      del.onclick = () => Model.removeInflection(langId, set.id);
      if (!lines.length) {
        const note = td('note');
        note.colSpan = 2;
        note.textContent = set.pos ? `No forms yet: add layers under "${ctx.posName(set.pos)}" in Inflection Types.` : 'Give this word a part of speech in the Lexicon.';
        first.appendChild(note);
      }
      lines.forEach((line, k) => {
        const tr = k === 0 ? first : document.createElement('tr');
        if (k) tr.dataset.row = `${set.id}:${line.key ?? 'legacy' + line.legacy}`;
        else first.dataset.row = `${set.id}:${line.key ?? 'legacy' + line.legacy}`;
        const label = td('form-name' + (line.key ? '' : ' legacy'));
        label.textContent = line.label;
        if (!line.key) label.title = 'This form is no longer in Inflection Types';
        tr.appendChild(label);
        const cell = td('c-word');
        const rowRef = { id: `${set.id}:${line.key ?? 'legacy' + line.legacy}`, cells: {} };
        cell.appendChild(textCell(t, rowRef, { id: 'inflected', name: line.label }, line.value, 'word', (c, v, o) => {
          if (line.key) Model.setForm(langId, set.lex, line.key, v, o);
          else Store.updateCell(langId, 'forms', line.legacy, 'text', v, o);
        }, ctx));
        tr.appendChild(cell);
        const act = td('act');
        if (k === 0) act.appendChild(del);
        else if (!line.key) {
          const x = del.cloneNode(true);
          x.title = 'Remove this old form';
          x.onclick = () => Store.deleteRow(langId, 'forms', line.legacy);
          act.appendChild(x);
        }
        tr.appendChild(act);
        if (k) tbody.appendChild(tr);
        if (k === 0) tbody.appendChild(first);
      });
      if (!lines.length) { const act = td('act'); act.appendChild(del); first.appendChild(act); tbody.appendChild(first); }
    });
    if (!sets.length) tbody.insertAdjacentHTML('beforeend', `<tr class="empty-note"><td colspan="6">Words get their inflections from the Lexicon: choose New in a word's Inflection column.</td></tr>`);
    table.appendChild(tbody);
    container.replaceChildren(table);
  }

  // Inflection Types: each part of speech has a type, drawn as a tree of layers from left to right. A value's
  // → button starts a new layer under it; the empty cell at the bottom of each list adds another value to it.
  // A value spans the rows of everything under it, like merged cells in a spreadsheet.
  function renderLayers(container, langId, ctx) {
    const T = 'inflectionTypes', V = 'inflectionValues';
    const values = Store.rows(langId, V);
    // A node is a type (the part of speech column) or a value (any layer).
    const typeNode = row => ({ id: row.id, row, table: T, type: row.id, parent: '' });
    const valueNode = row => ({ id: row.id, row, table: V, type: row.cells.type, parent: row.id });
    const kids = node => values.filter(v => v.cells.type === node.type && (v.cells.parent || '') === node.parent).map(valueNode);
    const depthOf = node => { const k = kids(node); return k.length ? 1 + Math.max(...k.map(depthOf)) : 0; };
    const height = node => { const k = kids(node); return k.length ? k.reduce((n, x) => n + height(x), 0) + 1 : 1; };
    const roots = Store.rows(langId, T).map(typeNode);
    // Columns: part of speech, then one per layer.
    const cols = 1 + Math.max(1, ...roots.map(depthOf));

    const table = document.createElement('table');
    table.className = 'grid layers';
    table.dataset.table = T;
    table.innerHTML = '<thead><tr><th>Part of Speech</th>' + Array.from({ length: cols - 1 }, (_, i) => `<th>Layer ${i + 1}</th>`).join('') + '<th class="act"></th></tr></thead>';
    const tbody = document.createElement('tbody');
    const lines = []; // one array of cells per table row
    const line = i => (lines[i] ||= []);

    const nameOf = node => (node.table === T ? ctx.posName(node.row.cells.pos) : node.row.cells.label) || 'this';
    const remove = node => Store.deleteRow(langId, node.table, node.id);
    // Deleting takes everything under it along, including what words have written for those forms.
    // Only that last part is worth stopping for: ask (inside the cell) when filled-in forms would go.
    const confirmRemove = (node, box) => {
      const n = Model.formsLostBy(langId, node.table, node.id);
      if (!n) return remove(node);
      const ask = document.createElement('div');
      ask.className = 'layer-confirm';
      ask.innerHTML = `<span>Delete “${esc(nameOf(node))}”? This removes ${n} filled-in form${n === 1 ? '' : 's'} from your words.</span>`;
      const yes = Object.assign(document.createElement('button'), { className: 'danger', textContent: 'Delete' });
      const no = Object.assign(document.createElement('button'), { textContent: 'Cancel' });
      yes.onclick = () => remove(node);
      no.onclick = () => ask.replaceWith(box);
      ask.append(yes, no);
      box.replaceWith(ask);
      yes.focus();
    };

    // A node's cell: its label (a part of speech dropdown for a type), its ↓ and → buttons if it has no layer yet, and delete.
    const itemCell = (node, above, depth, r) => {
      const td = document.createElement('td');
      td.className = 'layer-item' + (depth === 0 ? ' layer-root' : '');
      td.dataset.row = node.id;
      const leaf = !kids(node).length;
      td.rowSpan = height(node);
      if (leaf) td.colSpan = cols - depth;
      const box = document.createElement('div');
      box.className = 'layer-box';
      box.appendChild(depth === 0 ? posField(ctx.pos(), node.row.cells.pos, v => Store.updateCell(langId, T, node.id, 'pos', v, { focus: {} }))
        : labelField(node.row.cells.label, v => Store.updateCell(langId, V, node.id, 'label', v, { silent: true, coalesce: `${T}:${node.id}:label` })));
      if (leaf) {
        // ↓ copies the layers under the value above this one (same list) to this one.
        if (depth > 0 && above && kids(above).length) {
          const copy = document.createElement('button');
          copy.className = 'layer-next';
          copy.textContent = '↓';
          copy.title = `Copy the layers under "${above.row.cells.label || 'the item above'}" to this`;
          copy.tabIndex = -1;
          copy.onclick = () => Model.copyLayers(langId, above.id, node.id);
          box.appendChild(copy);
        }
        const next = document.createElement('button');
        next.className = 'layer-next';
        next.textContent = '→';
        next.title = 'Add a layer under this';
        next.tabIndex = -1;
        next.onclick = () => Model.addValue(langId, node.type, node.parent, '');
        box.appendChild(next);
      }
      const del = document.createElement('button');
      del.className = 'layer-del';
      del.innerHTML = TRASH;
      del.title = depth === 0 ? 'Delete this part of speech and its layers' : 'Delete this and everything under it';
      del.tabIndex = -1;
      del.onclick = () => confirmRemove(node, box);
      box.appendChild(del);
      td.appendChild(box);
      line(r).push(td);
    };
    // The empty cell at the bottom of a list: typing (or choosing) there adds to the list.
    const addCell = (parent, depth, r) => {
      const td = document.createElement('td');
      td.className = 'layer-add';
      td.dataset.row = 'add-' + (parent ? parent.id : 'root');
      td.colSpan = cols - depth;
      let created = null;
      td.appendChild(depth === 0
        ? posField(ctx.pos(), '', v => { if (v) Model.addType(langId, v); }, 'Add a part of speech…')
        : labelField('', v => {
          if (created) return Store.updateCell(langId, V, created, 'label', v, { silent: true, coalesce: `${T}:${created}:label` });
          created = Model.addValue(langId, parent.type, parent.parent, v);
        }, depth === 1 ? 'Add a value…' : 'Add…'));
      line(r).push(td);
    };

    // Lay out a list starting at row r, at the given depth; returns the row after it.
    const layout = (list, parent, depth, r) => {
      list.forEach((node, i) => {
        itemCell(node, list[i - 1], depth, r);
        const under = kids(node);
        if (under.length) layout(under, node, depth + 1, r);
        r += height(node);
      });
      addCell(parent, depth, r);
      return r + 1;
    };
    const total = layout(roots, null, 0, 0);
    for (let i = 0; i < total; i++) {
      const tr = document.createElement('tr');
      if (lines[i]?.some(td => td.classList.contains('layer-root')) || (i === total - 1 && i > 0)) tr.className = 'group-start';
      if (i === total - 1) tr.classList.add('blank');
      (lines[i] || []).forEach(td => tr.appendChild(td));
      tr.insertAdjacentHTML('beforeend', '<td class="act"></td>');
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.replaceChildren(table);
  }
  function labelField(value, onInput, placeholder = '') {
    const input = document.createElement('input');
    input.value = value || '';
    input.dataset.col = 'label';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', 'Value');
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }
  // A part of speech dropdown. list: [{ id, name }]; the value is a part of speech id.
  function posField(list, value, onChange, emptyLabel = '', col = 'pos') {
    const sel = document.createElement('select');
    sel.className = 'pos-select';
    sel.dataset.col = col;
    sel.setAttribute('aria-label', 'Part of speech');
    sel.innerHTML = `<option value="">${esc(emptyLabel)}</option>` +
      list.map(o => `<option value="${esc(o.id)}"${o.id === value ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
    sel.onchange = () => onChange(sel.value || undefined);
    return sel;
  }

  // Text / IPA / Literal switch, only on columns written in the language.
  function viewToggle(tableId, colId) {
    const type = Store.columnType(tableId, colId);
    if (type !== 'word' && type !== 'phrase') return '';
    const cur = viewOf(tableId, colId);
    return '<span class="view-toggle" role="group" aria-label="Show as">' + VIEWS.map(([v, label, title]) =>
      `<button type="button" data-view="${v}" title="${title}" aria-pressed="${v === cur}" tabindex="-1">${label}</button>`).join('') + '</span>';
  }

  // g.columns: which columns to draw (default all); g.span: rowspan per column id; g.index: where the empty
  // row inserts its new row (default the end); g.blankId: id for an empty row; g.filler: empty cells to pad with.
  function rowEl(langId, t, row, num, ctx, g = {}) {
    const tr = document.createElement('tr');
    tr.dataset.row = row ? row.id : (g.blankId || 'blank');
    if (!row) tr.className = 'blank' + (g.blankId ? ' add' : '');
    tr.innerHTML = `<td class="num">${num}</td>`;

    // Write a value into this row, creating the row first if this is the empty row.
    let createdId = null;
    const write = (colId, value, opts = {}) => {
      if (row || createdId) return Store.updateCell(langId, t.id, row?.id || createdId, colId, value, opts);
      const id = createdId = newId();
      Store.addRow(langId, t.id, { [colId]: value }, { id, index: g.index, coalesce: `${t.id}:${id}:${colId}`, meta: { focus: { table: t.id, row: id, col: colId, ...opts.focus } } });
    };

    (g.columns || t.columns).forEach(col => {
      const td = document.createElement('td');
      if (g.span?.[col.id] > 1) { td.rowSpan = g.span[col.id]; td.classList.add('group-head'); }
      const type = Store.columnType(t.id, col.id);
      const value = row ? row.cells[col.id] : undefined;
      td.classList.add('c-' + type);
      if (type === 'text' || type === 'word' || type === 'phrase') td.appendChild(textCell(t, row, col, value, type, write, ctx));
      else if (type === 'pos') td.appendChild(posField(ctx.pos(), value, v => write(col.id, v, { focus: {} }), '', col.id));
      else if (type === 'inflection') td.appendChild(inflectionCell(t, row, col, value, write, ctx));
      else if (type === 'diphthong') td.appendChild(diphthongCell(t, row, col, value, write));
      else td.appendChild(phonemeCell(t, row, col, value, type, write));
      tr.appendChild(td);
    });

    if (g.filler) tr.insertAdjacentHTML('beforeend', `<td class="filler" colspan="${g.filler}"></td>`);
    const del = document.createElement('td');
    del.className = 'act';
    if (row) {
      del.innerHTML = `<button class="del" title="Delete row" aria-label="Delete row" tabindex="-1">${TRASH}</button>`;
      del.firstChild.onclick = () => Store.deleteRow(langId, t.id, row.id);
    }
    tr.appendChild(del);
    return tr;
  }

  function textCell(t, row, col, value, type, write, ctx, readOnly = false) {
    const input = document.createElement('input');
    input.value = value || '';
    input.readOnly = readOnly;
    if (readOnly && row?.cells.model) input.dataset.lex = row.cells.model;
    if (t.id === 'inflections' && col.id === 'name' && row) input.placeholder = 'like ' + (ctx.lexiconWord(row.cells.model) ?? '');
    input.dataset.col = col.id;
    input.setAttribute('aria-label', col.name);
    input.spellcheck = type === 'text';
    let overlay = null, wrap = null, say = null;
    const repaint = () => {
      if (!overlay) return;
      const view = document.activeElement === input ? 'text' : viewOf(t.id, col.id);
      wrap.dataset.view = view;
      paintWord(overlay, input.value, ctx, type === 'phrase', view);
      paintUsage(wrap, input.value, ctx);
      say.hidden = !input.value.trim();
      overlay.scrollLeft = input.scrollLeft;
    };
    input.addEventListener('input', () => {
      repaint();
      const silent = !!row;
      write(col.id, input.value, { silent, coalesce: row ? `${t.id}:${row.id}:${col.id}` : undefined, focus: { caret: input.selectionStart } });
    });
    if (type === 'text') return input;
    wrap = document.createElement('div');
    wrap.dataset.table = t.id;
    wrap.dataset.column = col.id;
    wrap.className = 'word';
    if (type === 'phrase') wrap.dataset.lexicon = '1';
    overlay = document.createElement('div');
    overlay.className = 'word-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    wrap.append(overlay, input);
    // Speaker button: says the whole cell.
    say = document.createElement('button');
    say.className = 'say';
    say.tabIndex = -1;
    say.title = 'Hear it';
    say.setAttribute('aria-label', 'Hear ' + col.name);
    say.onmousedown = e => e.preventDefault();
    say.onclick = () => Speech.say(input.value, ctx.inventory(), say);
    wrap.appendChild(say);
    if (t.id === 'lexicon' && col.id === 'word') {
      const badge = document.createElement('span');
      badge.className = 'usage';
      wrap.classList.add('has-usage');
      wrap.appendChild(badge);
    }
    // In IPA view the painted symbols sit on top: clicking (or right-clicking) one plays it,
    // and clicking anywhere else in the cell edits the text.
    const playSym = e => {
      const sym = e.target.closest('.ipa-sym');
      if (!sym) return false;
      e.preventDefault();
      Sound.play(sym.dataset.sym.split(' '), sym);
      return true;
    };
    overlay.addEventListener('mousedown', e => { if (!playSym(e) && e.button === 0) { e.preventDefault(); input.focus(); } });
    overlay.addEventListener('contextmenu', e => { if (e.target.closest('.ipa-sym')) e.preventDefault(); });
    input.addEventListener('scroll', repaint);
    input.addEventListener('focus', repaint);
    input.addEventListener('blur', repaint);
    input.addEventListener('keyup', () => { overlay.scrollLeft = input.scrollLeft; });
    repaint();
    return wrap;
  }

  // Consonant or vowel: shows /x/. Click opens the IPA chart, right-click plays it.
  function phonemeCell(t, row, col, value, type, write) {
    const sym = [].concat(value || [])[0];
    const b = document.createElement('button');
    b.className = 'phon';
    b.dataset.col = col.id;
    b.textContent = sym ? `/${sym}/` : '';
    b.setAttribute('aria-label', col.name + (sym ? ' ' + sym : ''));
    b.onclick = () => Picker.open(b, type, sym, picked => write(col.id, picked ? [picked] : undefined, { focus: {} }));
    b.oncontextmenu = e => { if (sym) { e.preventDefault(); Sound.play(sym, b); } };
    return b;
  }

  // Diphthong: a sequence of vowels, each clickable to change; + adds another vowel.
  function diphthongCell(t, row, col, value, write) {
    const list = Array.isArray(value) ? value : [];
    const box = document.createElement('div');
    box.className = 'phon-multi';
    box.oncontextmenu = e => { if (list.length && !e.target.closest('.phon-add')) { e.preventDefault(); Sound.play(list, box); } };
    const set = next => write(col.id, next.length ? next : undefined, { focus: {} });

    if (!list.length) {
      const b = document.createElement('button');
      b.className = 'phon';
      b.dataset.col = col.id;
      b.setAttribute('aria-label', col.name);
        b.onclick = () => Picker.open(b, 'vowel', null, sym => sym && set([sym]));
      box.appendChild(b);
      return box;
    }
    const slash = () => Object.assign(document.createElement('span'), { className: 'slash', textContent: '/' });
    box.appendChild(slash());
    list.forEach((v, i) => {
      const b = document.createElement('button');
      b.className = 'phon-part';
      b.textContent = v;
      if (i === 0) b.dataset.col = col.id;
      b.title = 'Click to change · right-click to hear';
        b.onclick = () => Picker.open(b, 'vowel', v, sym => {
        const next = list.slice();
        if (sym) next[i] = sym; else next.splice(i, 1);
        set(next);
      }, { clearLabel: 'Remove' });
      b.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); Sound.play(v, b); };
      box.appendChild(b);
    });
    box.appendChild(slash());
    const add = document.createElement('button');
    add.className = 'phon-add';
    add.textContent = '+';
    add.title = 'Add a vowel';
    add.setAttribute('aria-label', 'Add a vowel');
    add.onclick = () => Picker.open(add, 'vowel', null, sym => sym && set([...list, sym]));
    box.appendChild(add);
    return box;
  }

  // Lexicon: which inflection the word follows. Once the word has a part of speech, offers the inflections
  // whose model shares it, plus New (which sets one up from Inflection Types). Hover shows the word's forms.
  function inflectionCell(t, row, col, value, write, ctx) {
    const sel = document.createElement('select');
    sel.className = 'pos-select';
    sel.dataset.col = col.id;
    sel.setAttribute('aria-label', col.name);
    const pos = row?.cells.pos;
    const fill = () => {
      const all = ctx.patterns();
      const current = Parse.findPattern(all, value);
      const options = pos ? all.filter(p => p.pos === pos) : [];
      if (current && !options.includes(current)) options.push(current);
      sel.innerHTML = '<option value=""></option>' +
        options.map(p => `<option value="${esc(p.id)}"${p === current ? ' selected' : ''}>${esc(p.name)}</option>`).join('') +
        (row && pos ? '<option value="__new">New…</option>' : '');
      sel.title = current && row?.cells.word ? Parse.follow(row.cells.word, current).map(f => `${f.form}: ${f.inflected}`).join('\n')
        : pos ? '' : 'Choose a part of speech first';
    };
    fill();
    sel.disabled = !pos && !value;
    sel.addEventListener('focus', fill);
    sel._refresh = fill;
    sel.onchange = () => {
      if (sel.value === '__new') ctx.newInflection(row.id);
      else write(col.id, sel.value || undefined, { focus: {} });
    };
    return sel;
  }

  const TRASH = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4M3.8 4l.7 9.5h7l.7-9.5M6.5 6.5v4.5M9.5 6.5v4.5"/></svg>';


  // Keyboard movement, like Google Sheets / Excel:
  //   Enter / Shift+Enter: down / up (after Tab-ing across a row, Enter goes back to the column you started in),
  //   Tab / Shift+Tab: right / left (the browser's own order), arrow up / down: up / down.
  // "Down" means the nearest cell below that covers the same horizontal spot, so it works across merged cells too.
  let tabColumn = null; // where a run of Tabs started, for Enter to come back to
  const cellOf = el => el.closest('td, th');
  const centerX = el => { const r = cellOf(el).getBoundingClientRect(); return (r.left + r.right) / 2; };
  function cellNext(table, el, x, dir) {
    const cur = cellOf(el).getBoundingClientRect();
    let best = null, bestDist = Infinity;
    for (const c of table.querySelectorAll('tbody [data-col]')) {
      if (!/^(INPUT|SELECT|BUTTON)$/.test(c.tagName) || c.disabled || c.offsetParent === null) continue;
      const r = cellOf(c).getBoundingClientRect();
      if (x < r.left || x > r.right) continue;
      const dist = dir > 0 ? r.top - (cur.bottom - 1) : (cur.top + 1) - r.bottom;
      if (dist >= 0 && dist < bestDist) { best = c; bestDist = dist; }
    }
    return best;
  }
  document.addEventListener('keydown', e => {
    const el = e.target;
    const table = el.closest?.('table.grid');
    if (!table || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || Picker.isOpen()) return;
    if (e.key === 'Tab') { if (tabColumn == null) tabColumn = centerX(el); return; }
    let dir = 0;
    if (e.key === 'Enter' && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) dir = e.shiftKey ? -1 : 1;
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && el.tagName !== 'SELECT') dir = e.key === 'ArrowDown' ? 1 : -1;
    if (!dir) return;
    e.preventDefault();
    const x = e.key === 'Enter' && tabColumn != null ? tabColumn : centerX(el);
    tabColumn = null;
    const target = cellNext(table, el, x, dir);
    if (!target) return;
    target.focus();
    if (target.tagName === 'INPUT') target.setSelectionRange(target.value.length, target.value.length);
  });
  document.addEventListener('mousedown', () => { tabColumn = null; });

  // Repaint every word cell's overlay (after the phonology changes).
  function repaintWords(root, ctx) {
    root.querySelectorAll('select[data-col=inflection]').forEach(s => s._refresh?.());
    root.querySelectorAll('.word').forEach(w => {
      const input = w.querySelector('input');
      if (input.dataset.lex) input.value = ctx.lexiconWord(input.dataset.lex) ?? input.value;
      const view = document.activeElement === input ? 'text' : viewOf(w.dataset.table, w.dataset.column);
      w.dataset.view = view;
      paintWord(w.querySelector('.word-overlay'), input.value, ctx, !!w.dataset.lexicon, view);
      paintUsage(w, input.value, ctx);
      w.querySelector('.say').hidden = !input.value.trim();
    });
  }

  return { render, repaintWords, esc };
})();
