const $ = s => document.querySelector(s);
const thead = $('#sheet thead'), tbody = $('#sheet tbody');
let langId = null;

// ---- Tabs inside a language: Phrases, Phonology, Lexicon ----
function showTab(name) {
  document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== 'tab-' + name; });
}
document.querySelectorAll('.tabs [role=tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

// ---- Routing: "#" is the home screen, "#lang-<id>" is a language's sheet ----
function route() {
  const m = location.hash.match(/^#lang-(\w+)$/);
  langId = m && Store.language(m[1]) ? m[1] : null;
  $('#home').hidden = !!langId;
  $('#sheet-view').hidden = !langId;
  if (langId) {
    $('#crumb').textContent = ' / ' + Store.language(langId).name;
    document.title = Store.language(langId).name + ' · LangKit';
    showTab('phrases');
    renderSheet();
    tbody.querySelector('tr:last-child input')?.focus();
  } else {
    $('#crumb').textContent = '';
    document.title = 'LangKit';
    renderHome();
  }
}

// ---- Home: create a language, list existing ones ----
function renderHome() {
  const langs = Store.languages();
  $('#lang-list-section').hidden = !langs.length;
  $('#lang-list').innerHTML = '';
  langs.forEach(lang => {
    const li = document.createElement('li');
    const n = lang.tables[0].rows.length;
    li.innerHTML = `<a href="#lang-${lang.id}">${esc(lang.name)}</a><span class="muted">${n} ${n === 1 ? 'entry' : 'entries'}</span><button class="link" title="Delete language">Delete</button>`;
    // Two-step delete in the page itself (embedded viewers block confirm() dialogs).
    const btn = li.querySelector('button');
    btn.onclick = () => {
      if (btn.dataset.armed) { Store.deleteLanguage(lang.id); renderHome(); return; }
      btn.dataset.armed = '1';
      btn.textContent = `Delete ${lang.name} and all entries?`;
      btn.classList.add('danger');
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Delete'; btn.classList.remove('danger'); } }, 4000);
    };
    $('#lang-list').appendChild(li);
  });
  $('#lang-name').focus();
}

$('#create-form').onsubmit = e => {
  e.preventDefault();
  const name = $('#lang-name').value.trim();
  if (!name) return;
  $('#lang-name').value = '';
  location.hash = '#lang-' + Store.createLanguage(name).id;
};

// ---- Sheet: one row per entry, plus an always-empty row at the bottom ----
function renderSheet(focus) {
  const t = Store.table(langId);

  thead.innerHTML = '<tr><th class="num">#</th>' +
    t.columns.map(c => `<th>${esc(c.name)}</th>`).join('') + '<th class="act"></th></tr>';

  tbody.innerHTML = '';
  t.rows.forEach((row, i) => tbody.appendChild(rowEl(t, row, i + 1)));
  tbody.appendChild(rowEl(t, null, t.rows.length + 1)); // the empty row

  if (focus) {
    const input = tbody.querySelector(`tr[data-id="${focus.row}"] input[data-col="${focus.col}"]`);
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
}

function rowEl(t, row, num) {
  const tr = document.createElement('tr');
  if (row) tr.dataset.id = row.id; else tr.className = 'blank';
  tr.innerHTML = `<td class="num">${num}</td>`;
  t.columns.forEach(col => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.value = row ? row.cells[col.id] || '' : '';
    input.dataset.col = col.id;
    input.setAttribute('aria-label', col.name);
    input.addEventListener('input', () => {
      if (row) return Store.updateCell(langId, row.id, col.id, input.value);
      // Typing in the empty row turns it into a real row and adds a fresh empty row below.
      const created = Store.addRow(langId, { [col.id]: input.value });
      renderSheet({ row: created.id, col: col.id });
    });
    input.addEventListener('keydown', e => onKey(e, tr, col.id));
    td.appendChild(input);
    tr.appendChild(td);
  });
  const del = document.createElement('td');
  del.className = 'act';
  if (row) {
    del.innerHTML = '<button title="Delete row" aria-label="Delete row" tabindex="-1">×</button>';
    del.firstChild.onclick = () => { Store.deleteRow(langId, row.id); renderSheet(); };
  }
  tr.appendChild(del);
  return tr;
}

// Spreadsheet-style keys: Enter / arrows move up and down within a column.
function onKey(e, tr, col) {
  let target;
  if (e.key === 'Enter' || e.key === 'ArrowDown') target = tr.nextElementSibling;
  else if (e.key === 'ArrowUp') target = tr.previousElementSibling;
  else return;
  e.preventDefault();
  target?.querySelector(`input[data-col="${col}"]`)?.focus();
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }


window.addEventListener('hashchange', route);
route();
