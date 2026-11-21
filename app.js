const $ = s => document.querySelector(s);
let langId = null;
let currentTab = 'phrases';

// ---------- What is on screen (so undo/redo can bring it back) ----------
function focusInfo() {
  const el = document.activeElement;
  const table = el?.closest?.('table.grid');
  const tr = el?.closest?.('tr');
  const col = el?.closest?.('td')?.querySelector('[data-col]')?.dataset.col || el?.dataset?.col;
  if (!table || !tr || !col) return null;
  return { table: table.dataset.table, row: tr.dataset.row, col, caret: el.tagName === 'INPUT' ? el.selectionStart : null };
}
Store.setViewProvider(() => ({ hash: location.hash, tab: currentTab, focus: focusInfo() }));

function restoreFocus(f) {
  if (!f) return;
  const table = document.querySelector(`table.grid[data-table="${f.table}"]`);
  const tr = table?.querySelector(`tr[data-row="${f.row}"]`) || table?.querySelector('tr.blank');
  const el = tr?.querySelector(`[data-col="${f.col}"]`);
  if (!el) return;
  el.focus();
  if (el.tagName === 'INPUT') {
    const pos = f.caret == null ? el.value.length : Math.min(f.caret, el.value.length);
    el.setSelectionRange(pos, pos);
  }
}

// ---------- Tabs inside a language: Phrases, Phonology, Lexicon ----------
function showTab(name) {
  currentTab = name;
  document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== 'tab-' + name; });
}
document.querySelectorAll('.tabs [role=tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

// ---------- Routing: "#" is the home screen, "#lang-<id>" is a language ----------
let pendingView = null;
function route() {
  const m = location.hash.match(/^#lang-(\w+)$/);
  langId = m && Store.language(m[1]) ? m[1] : null;
  $('#home').hidden = !!langId;
  $('#sheet-view').hidden = !langId;
  const view = pendingView;
  pendingView = null;
  if (langId) {
    const lang = Store.language(langId);
    $('#crumb').textContent = ' / ' + lang.name;
    document.title = lang.name + ' · LangKit';
    showTab(view?.tab || 'phrases');
    renderLanguage();
    if (view) restoreFocus(view.focus);
    else document.querySelector('#tab-phrases tr.blank input')?.focus();
  } else {
    $('#crumb').textContent = '';
    document.title = 'LangKit';
    renderHome();
  }
}

// ---------- Home: create a language, list existing ones ----------
function renderHome() {
  const langs = Store.languages();
  $('#lang-list-section').hidden = !langs.length;
  $('#lang-list').innerHTML = '';
  langs.forEach(lang => {
    const li = document.createElement('li');
    const n = lang.tables.find(t => t.id === 'phrases').rows.length;
    li.innerHTML = `<a href="#lang-${lang.id}">${Sheet.esc(lang.name)}</a><span class="muted">${n} ${n === 1 ? 'phrase' : 'phrases'}</span><button class="link" title="Delete language">Delete</button>`;
    // Two-step delete in the page itself (embedded viewers block confirm() dialogs).
    const btn = li.querySelector('button');
    btn.onclick = () => {
      if (btn.dataset.armed) { Store.deleteLanguage(lang.id); return; }
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

// ---------- A language's tables ----------
const ctx = {
  inventory: () => Parse.inventory(Store.language(langId)),
  lexicon: () => Parse.lexicon(Store.language(langId)),
  glosses: () => Parse.glosses(Store.language(langId)),
  usage: () => Parse.usage(Store.language(langId)),
};
function renderLanguage() {
  Sheet.render($('#phrases-table'), langId, 'phrases', ctx);
  for (const id of ['lexicon', 'consonants', 'vowels', 'diphthongs']) Sheet.render($(`#${id}-table`), langId, id, ctx);
}

// ---------- React to changes ----------
Store.subscribe(e => {
  if (e.kind === 'do') {
    // Typing in an existing cell: the screen already shows it; just refresh the word highlighting.
    if (e.silent) { if (langId) Sheet.repaintWords($('#sheet-view'), ctx); return; }
    const focus = e.meta?.focus || focusInfo();
    if (!langId || !Store.language(langId)) { location.hash === '' ? route() : (location.hash = ''); return; }
    renderLanguage();
    restoreFocus(focus);
    return;
  }
  // Undo / redo: go back to where the change was made.
  Picker.close();
  const view = e.view || {};
  const target = view.hash && view.hash.startsWith('#lang-') && Store.language(view.hash.slice(6)) ? view.hash : '';
  if (target !== location.hash) { pendingView = view; location.hash = target; return; }
  if (!langId) { renderHome(); return; }
  if (view.tab) showTab(view.tab);
  renderLanguage();
  restoreFocus(view.focus);
});

// Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z or Ctrl+Y redo. These replace the browser's own text undo,
// so every change in the app goes through one history.
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'y') {
    e.preventDefault();
    if (k === 'y' || e.shiftKey) Store.redo(); else Store.undo();
  }
}, true);
// Moving to a different cell starts a new undo step for typing.
document.addEventListener('focusin', () => {
  const f = focusInfo();
  if (!f || `${f.table}:${f.row}:${f.col}` !== Store.coalesceKey()) Store.breakCoalescing();
});

window.addEventListener('hashchange', route);
route();
