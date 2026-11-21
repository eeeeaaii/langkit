// The IPA chart popup. Left-click a symbol to choose it, right-click to hear it.
const Picker = (() => {
  let el = null, onPick = null, anchor = null;

  const sym = (s, current) => {
    if (s === null) return '<span class="ipa-cell impossible"></span>';
    if (!s) return '<span class="ipa-cell"></span>';
    return `<button class="ipa-cell${s === current ? ' current' : ''}" data-sym="${s}" title="Right-click to hear">${s}</button>`;
  };

  function consonantChart(current) {
    const head = '<tr><th></th>' + IPA.places.map(p => `<th colspan="2">${p}</th>`).join('') + '</tr>';
    const rows = IPA.consonants.map(([manner, cells]) =>
      `<tr><th>${manner}</th>` + cells.map(([a, b]) => `<td>${sym(a, current)}</td><td>${sym(b, current)}</td>`).join('') + '</tr>').join('');
    const others = IPA.otherConsonants.map(([name, list]) =>
      `<div class="ipa-group"><span class="ipa-group-name">${name}</span>${list.map(s => sym(s, current)).join('')}</div>`).join('');
    return `<div class="ipa-scroll"><table class="ipa-chart">${head}${rows}</table></div><div class="ipa-others">${others}</div>`;
  }

  function vowelChart(current) {
    const head = '<tr><th></th>' + IPA.backness.map(b => `<th colspan="2">${b}</th>`).join('') + '</tr>';
    const rows = IPA.vowels.map((cells, i) =>
      `<tr><th>${IPA.heights[i]}</th>` + cells.map(([a, b]) => `<td>${sym(a, current)}</td><td>${sym(b, current)}</td>`).join('') + '</tr>').join('');
    return `<table class="ipa-chart vowels">${head}${rows}</table><p class="ipa-note">In each pair, the left vowel is unrounded and the right is rounded.</p>`;
  }

  function close() {
    if (!el) return;
    el.remove();
    el = null;
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', onKey, true);
    const a = anchor;
    anchor = onPick = null;
    if (a?.isConnected) a.focus();
  }
  const outside = e => { if (el && !el.contains(e.target)) close(); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };

  // kind: 'consonant' | 'vowel'. pick(symbol) is called with the chosen symbol, or null for Clear.
  function open(anchorEl, kind, current, pick, { clearLabel = 'Clear' } = {}) {
    close();
    anchor = anchorEl;
    onPick = pick;
    el = document.createElement('div');
    el.className = 'ipa-popup';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="ipa-bar"><b>${kind === 'vowel' ? 'Vowels' : 'Consonants'}</b>
      <span class="ipa-hint">Click to choose · right-click to hear</span>
      ${current ? `<button class="ipa-clear">${clearLabel}</button>` : ''}</div>` +
      (kind === 'vowel' ? vowelChart(current) : consonantChart(current));
    document.body.appendChild(el);

    el.addEventListener('click', e => {
      const b = e.target.closest('[data-sym]');
      if (b) { const fn = onPick; close(); fn(b.dataset.sym); return; }
      if (e.target.closest('.ipa-clear')) { const fn = onPick; close(); fn(null); }
    });
    el.addEventListener('contextmenu', e => {
      const b = e.target.closest('[data-sym]');
      if (b) { e.preventDefault(); Sound.play(b.dataset.sym, b); }
    });

    // Place below the cell, kept inside the window.
    const r = anchorEl.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = Math.min(r.left, window.innerWidth - w - 8);
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8 && r.top - h - 4 > 8) top = r.top - h - 4;
    el.style.left = Math.max(8, left) + window.scrollX + 'px';
    el.style.top = Math.max(8, top) + window.scrollY + 'px';
    (el.querySelector('.current') || el.querySelector('[data-sym]'))?.focus();

    setTimeout(() => {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', onKey, true);
    });
  }

  return { open, close, isOpen: () => !!el };
})();
