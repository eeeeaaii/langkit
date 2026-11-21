const TABLE = 'phrases';
const $ = s => document.querySelector(s);
const thead = $('#sheet thead'), tbody = $('#sheet tbody');

function render(focus) {
  const t = Store.table(TABLE);
  const q = $('#search').value.trim().toLowerCase();

  thead.innerHTML = '<tr><th class="num">#</th>' +
    t.columns.map(c => `<th>${esc(c.name)}</th>`).join('') + '<th class="act"></th></tr>';

  tbody.innerHTML = '';
  const rows = t.rows.filter(r => !q ||
    t.columns.some(c => (r.cells[c.id] || '').toLowerCase().includes(q)));

  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;
    tr.innerHTML = `<td class="num">${i + 1}</td>`;
    t.columns.forEach(col => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.value = row.cells[col.id] || '';
      input.dataset.col = col.id;
      input.setAttribute('aria-label', col.name);
      input.addEventListener('input', () => Store.updateCell(TABLE, row.id, col.id, input.value));
      input.addEventListener('keydown', e => onKey(e, tr, col.id));
      td.appendChild(input);
      tr.appendChild(td);
    });
    const del = document.createElement('td');
    del.className = 'act';
    del.innerHTML = '<button title="Delete row" aria-label="Delete row">×</button>';
    del.firstChild.onclick = () => { Store.deleteRow(TABLE, row.id); render(); };
    tr.appendChild(del);
    tbody.appendChild(tr);
  });

  $('#empty').hidden = t.rows.length > 0;
  $('#status').textContent = t.rows.length
    ? `${rows.length} of ${t.rows.length} rows` + (q ? ' match' : '') : '';

  if (focus) tbody.querySelector(`tr[data-id="${focus.row}"] input[data-col="${focus.col}"]`)?.focus();
}

// Spreadsheet-style keys: Enter moves down (adding a row at the end), arrows move between rows.
function onKey(e, tr, col) {
  let target;
  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    target = tr.nextElementSibling;
    if (!target && e.key === 'Enter') return addRow(col);
  } else if (e.key === 'ArrowUp') {
    target = tr.previousElementSibling;
  } else return;
  e.preventDefault();
  target?.querySelector(`input[data-col="${col}"]`)?.focus();
}

function addRow(col) {
  $('#search').value = '';
  const row = Store.addRow(TABLE);
  render({ row: row.id, col: col || Store.table(TABLE).columns[0].id });
}

function esc(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

$('#add-row').onclick = () => addRow();
$('#search').oninput = () => render();
$('#export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
  a.download = 'langkit.json';
  a.click();
};
$('#import').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { Store.importJSON(await file.text()); render(); }
  catch (err) { $('#status').textContent = 'Import failed: ' + err.message; }
  e.target.value = '';
};

render();
