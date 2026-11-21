// Plays IPA recordings. A sequence (for diphthongs) plays one after another.
// The element passed in gets the "playing" class until the sound finishes, for visual feedback.
const Sound = (() => {
  const cache = {};
  let queue = [];
  let lit = null;
  function clip(sym) {
    const file = IPA.audio[sym];
    if (!file) return null;
    return (cache[sym] ||= new Audio('audio/ipa/' + file));
  }
  function unlight() { lit?.classList.remove('playing'); lit = null; }
  function play(symbols, el) {
    queue.forEach(a => { a.pause(); a.onended = a.onerror = null; });
    unlight();
    queue = [].concat(symbols).map(clip).filter(Boolean);
    if (!queue.length) return;
    if (el) { lit = el; el.classList.add('playing'); }
    const next = i => {
      const a = queue[i];
      if (!a) { unlight(); return; }
      a.currentTime = 0;
      a.onended = () => next(i + 1);
      a.onerror = () => next(i + 1);
      a.play().catch(() => next(i + 1));
    };
    next(0);
  }
  return { play, has: sym => !!IPA.audio[sym] };
})();
