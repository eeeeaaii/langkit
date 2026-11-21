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
    const t = Store.table(langId, tableId);
    const table = document.createElement('table');
    table.className = 'grid';
    table.dataset.table = tableId;
    table.innerHTML = '<thead><tr><th class="num">#</th>' +
      t.columns.map(c => `<th data-col="${c.id}">${esc(c.name)}${viewToggle(tableId, c.id)}</th>`).join('') + '<th class="act"></th></tr></thead>';
    table.querySelectorAll('.view-toggle button').forEach(b => b.onclick = () => {
      const th = b.closest('th');
      views.set(tableId + ':' + th.dataset.col, b.dataset.view);
      th.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      repaintWords(table, ctx);
    });
    const tbody = document.createElement('tbody');
    if (GROUPED[tableId]) renderGroups(tbody, langId, t, ctx);
    else {
      t.rows.forEach((row, i) => tbody.appendChild(rowEl(langId, t, row, i + 1, ctx)));
      tbody.appendChild(rowEl(langId, t, null, t.rows.length + 1, ctx));
    }
    table.appendChild(tbody);
    container.replaceChildren(table);
  }

  // Text / IPA / Literal switch, only on columns written in the language.
  function viewToggle(tableId, colId) {
    const type = Store.columnType(tableId, colId);
    if (type !== 'word' && type !== 'phrase') return '';
    const cur = viewOf(tableId, colId);
    return '<span class="view-toggle" role="group" aria-label="Show as">' + VIEWS.map(([v, label, title]) =>
      `<button type="button" data-view="${v}" title="${title}" aria-pressed="${v === cur}" tabindex="-1">${label}</button>`).join('') + '</span>';
  }

  // Grouped tables: the head columns are filled once per group (a part of speech, or a word) and the rows
  // under it hold its forms. In the data, a group is its first row (which has the head) plus the rows after
  // it with an empty head. On screen each group is a block: the head spans its rows, and an empty row at the
  // bottom of the block adds another form to that group. The empty row at the very bottom starts a new group.
  const GROUPED = {
    inflectionTypes: { key: 'pos', head: ['pos'] },
    inflections: { key: 'word', head: ['word', 'pattern'] },
  };
  const filled = v => Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());

  function renderGroups(tbody, langId, t, ctx) {
    const spec = GROUPED[t.id];
    const headCols = t.columns.filter(c => spec.head.includes(c.id));
    const bodyCols = t.columns.filter(c => !spec.head.includes(c.id));
    const groups = [];
    t.rows.forEach((row, i) => {
      if (filled(row.cells[spec.key]) || !groups.length) groups.push([]);
      groups[groups.length - 1].push({ row, i });
    });
    for (const g of groups) {
      const last = g[g.length - 1];
      const addRow = bodyCols.some(c => filled(last.row.cells[c.id]));
      const span = g.length + (addRow ? 1 : 0);
      g.forEach(({ row, i }, k) => {
        const tr = rowEl(langId, t, row, i + 1, ctx, k === 0
          ? { span: Object.fromEntries(headCols.map(c => [c.id, span])) }
          : { columns: bodyCols });
        if (k === 0) tr.classList.add('group-start');
        tbody.appendChild(tr);
      });
      if (addRow) tbody.appendChild(rowEl(langId, t, null, '', ctx, { columns: bodyCols, index: last.i + 1, blankId: 'add-' + g[0].row.id }));
    }
    const start = rowEl(langId, t, null, t.rows.length + 1, ctx, { columns: headCols, filler: bodyCols.length });
    if (groups.length) start.classList.add('group-start');
    tbody.appendChild(start);
  }

  // Delete a row of a grouped table. Deleting a group's first row moves its head onto the next row,
  // so the rest of the group stays together instead of joining the group above.
  function deleteGrouped(langId, t, row) {
    const spec = GROUPED[t.id];
    const i = t.rows.indexOf(row);
    const next = t.rows[i + 1];
    if (!filled(row.cells[spec.key]) || !next || filled(next.cells[spec.key])) return Store.deleteRow(langId, t.id, row.id);
    Store.transact('Delete row', () => {
      spec.head.forEach(c => { if (row.cells[c] !== undefined) Store.updateCell(langId, t.id, next.id, c, row.cells[c]); });
      Store.deleteRow(langId, t.id, row.id);
    });
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
      else if (type === 'pos') td.appendChild(posCell(t, row, col, value, write));
      else if (type === 'posOne') td.appendChild(posSelectCell(t, row, col, value, write));
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
      del.firstChild.onclick = () => GROUPED[t.id] ? deleteGrouped(langId, t, row) : Store.deleteRow(langId, t.id, row.id);
    }
    tr.appendChild(del);
    return tr;
  }

  function textCell(t, row, col, value, type, write, ctx) {
    const input = document.createElement('input');
    input.value = value || '';
    input.dataset.col = col.id;
    input.setAttribute('aria-label', col.name);
    input.spellcheck = type === 'text';
    input.addEventListener('keydown', e => moveKey(e, input));
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
    input.addEventListener('change', () => { if (row) ctx.committed?.(t.id, row.id, col.id, input.value); });
    // In grouped tables, the first letter typed into an empty cell redraws the table, so a group's
    // "add a form" row appears (or moves) as soon as its last row gets content.
    let wasEmpty = !input.value;
    input.addEventListener('input', () => {
      repaint();
      const silent = !!row && !(GROUPED[t.id] && wasEmpty);
      wasEmpty = !input.value;
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
    const b = document.createElement('button');
    b.className = 'phon';
    b.dataset.col = col.id;
    b.textContent = value ? `/${value}/` : '';
    b.setAttribute('aria-label', col.name + (value ? ' ' + value : ''));
    b.addEventListener('keydown', e => moveKey(e, b));
    b.onclick = () => Picker.open(b, type, value, sym => write(col.id, sym || undefined, { focus: {} }));
    b.oncontextmenu = e => { if (value) { e.preventDefault(); Sound.play(value, b); } };
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
      b.addEventListener('keydown', e => moveKey(e, b));
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
      b.addEventListener('keydown', e => moveKey(e, b));
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

  // Part of speech: a list of tags chosen from the standard parts of speech.
  function posCell(t, row, col, value, write) {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    const b = document.createElement('button');
    b.className = 'phon pos';
    b.dataset.col = col.id;
    b.textContent = list.join(', ');
    b.setAttribute('aria-label', col.name + (list.length ? ': ' + list.join(', ') : ''));
    b.addEventListener('keydown', e => moveKey(e, b));
    b.onclick = () => Picker.openList(b, POS, list, next => write(col.id, next.length ? next : undefined, { focus: {} }));
    return b;
  }
  const TRASH = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4M3.8 4l.7 9.5h7l.7-9.5M6.5 6.5v4.5M9.5 6.5v4.5"/></svg>';
  // One part of speech, from a dropdown. Empty means "same as the row above".
  // Lexicon: which named inflection the word follows. Offers the inflections whose model word shares a part
  // of speech with this word (all of them if this word has no part of speech yet). Hover shows the forms.
  function inflectionCell(t, row, col, value, write, ctx) {
    const sel = document.createElement('select');
    sel.className = 'pos-select';
    sel.dataset.col = col.id;
    sel.setAttribute('aria-label', col.name);
    const fill = () => {
      const pos = [].concat(row?.cells.pos || []);
      const all = ctx.patterns();
      const names = [...new Set(all.filter(p => !pos.length || p.pos.some(x => pos.includes(x))).map(p => p.name))];
      if (value && !names.includes(value)) names.push(value);
      sel.innerHTML = ['', ...names].map(o => `<option value="${esc(o)}"${o === (value || '') ? ' selected' : ''}>${esc(o)}</option>`).join('');
      const p = value && row?.cells.word && all.find(x => x.name.toLowerCase() === value.toLowerCase());
      sel.title = p ? Parse.follow(row.cells.word, p).map(f => `${f.form}: ${f.inflected}`).join('\n') : '';
    };
    fill();
    sel.addEventListener('focus', fill);
    sel.onchange = () => write(col.id, sel.value || undefined, { focus: {} });
    return sel;
  }

  function posSelectCell(t, row, col, value, write) {
    const sel = document.createElement('select');
    sel.className = 'pos-select';
    sel.dataset.col = col.id;
    sel.setAttribute('aria-label', col.name);
    const options = ['', ...POS];
    if (value && !POS.includes(value)) options.push(value); // keep anything typed before this was a dropdown
    sel.innerHTML = options.map(o => `<option value="${esc(o)}"${o === (value || '') ? ' selected' : ''}>${esc(o)}</option>`).join('');
    sel.onchange = () => write(col.id, sel.value || undefined, { focus: {} });
    return sel;
  }
  const POS = ['noun', 'pronoun', 'verb', 'adjective', 'adverb', 'preposition', 'postposition', 'conjunction', 'determiner', 'numeral', 'particle', 'interjection'];

  // Enter / arrows move up and down within a column, like a spreadsheet.
  function moveKey(e, el) {
    const isInput = el.tagName === 'INPUT';
    let dir = 0;
    if (e.key === 'ArrowDown' || (isInput && e.key === 'Enter')) dir = 1;
    else if (e.key === 'ArrowUp') dir = -1;
    if (!dir) return;
    e.preventDefault();
    const tr = el.closest('tr');
    const col = el.closest('td').querySelector('[data-col]')?.dataset.col || el.dataset.col;
    const target = dir > 0 ? tr.nextElementSibling : tr.previousElementSibling;
    target?.querySelector(`[data-col="${col}"]`)?.focus();
  }

  // Repaint every word cell's overlay (after the phonology changes).
  function repaintWords(root, ctx) {
    root.querySelectorAll('.word').forEach(w => {
      const input = w.querySelector('input');
      const view = document.activeElement === input ? 'text' : viewOf(w.dataset.table, w.dataset.column);
      w.dataset.view = view;
      paintWord(w.querySelector('.word-overlay'), input.value, ctx, !!w.dataset.lexicon, view);
      paintUsage(w, input.value, ctx);
      w.querySelector('.say').hidden = !input.value.trim();
    });
  }

  return { render, repaintWords, esc };
})();
