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
  const ipa = (text, inventory) => {
    let html = '', run = '';
    const flush = () => { if (run) html += `<span class="unknown">${esc(run)}</span>`; run = ''; };
    for (const s of Parse.segment(text, inventory)) {
      if (s.unknown) { run += s.text; continue; }
      flush();
      html += esc(s.ipa || s.text);
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
    t.rows.forEach((row, i) => tbody.appendChild(rowEl(langId, t, row, i + 1, ctx)));
    tbody.appendChild(rowEl(langId, t, null, t.rows.length + 1, ctx));
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

  function rowEl(langId, t, row, num, ctx) {
    const tr = document.createElement('tr');
    tr.dataset.row = row ? row.id : 'blank';
    if (!row) tr.className = 'blank';
    tr.innerHTML = `<td class="num">${num}</td>`;

    // Write a value into this row, creating the row first if this is the empty row.
    let createdId = null;
    const write = (colId, value, opts = {}) => {
      if (row || createdId) return Store.updateCell(langId, t.id, row?.id || createdId, colId, value, opts);
      const id = createdId = newId();
      Store.addRow(langId, t.id, { [colId]: value }, { id, coalesce: `${t.id}:${id}:${colId}`, meta: { focus: { table: t.id, row: id, col: colId, ...opts.focus } } });
    };

    t.columns.forEach(col => {
      const td = document.createElement('td');
      const type = Store.columnType(t.id, col.id);
      const value = row ? row.cells[col.id] : undefined;
      td.className = 'c-' + type;
      if (type === 'text' || type === 'word' || type === 'phrase') td.appendChild(textCell(t, row, col, value, type, write, ctx));
      else if (type === 'pos') td.appendChild(posCell(t, row, col, value, write));
      else if (type === 'diphthong') td.appendChild(diphthongCell(t, row, col, value, write));
      else td.appendChild(phonemeCell(t, row, col, value, type, write));
      tr.appendChild(td);
    });

    const del = document.createElement('td');
    del.className = 'act';
    if (row) {
      del.innerHTML = `<button class="del" title="Delete row" aria-label="Delete row" tabindex="-1">${TRASH}</button>`;
      del.firstChild.onclick = () => Store.deleteRow(langId, t.id, row.id);
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
    let overlay = null, wrap = null;
    const repaint = () => {
      if (!overlay) return;
      const view = document.activeElement === input ? 'text' : viewOf(t.id, col.id);
      wrap.dataset.view = view;
      paintWord(overlay, input.value, ctx, type === 'phrase', view);
      paintUsage(wrap, input.value, ctx);
      overlay.scrollLeft = input.scrollLeft;
    };
    input.addEventListener('input', () => {
      repaint();
      write(col.id, input.value, { silent: !!row, coalesce: row ? `${t.id}:${row.id}:${col.id}` : undefined, focus: { caret: input.selectionStart } });
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
    if (t.id === 'lexicon' && col.id === 'word') {
      const badge = document.createElement('span');
      badge.className = 'usage';
      wrap.classList.add('has-usage');
      wrap.appendChild(badge);
    }
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
    });
  }

  return { render, repaintWords, esc };
})();
