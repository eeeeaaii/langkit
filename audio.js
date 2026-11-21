// Plays IPA recordings. A sequence (for diphthongs) plays one after another.
const Sound = (() => {
  const cache = {};
  let queue = [];
  function clip(sym) {
    const file = IPA.audio[sym];
    if (!file) return null;
    return (cache[sym] ||= new Audio('audio/ipa/' + file));
  }
  function play(symbols) {
    queue.forEach(a => { a.pause(); a.onended = null; });
    queue = [].concat(symbols).map(clip).filter(Boolean);
    const next = i => {
      const a = queue[i];
      if (!a) return;
      a.currentTime = 0;
      a.onended = () => next(i + 1);
      a.play().catch(() => {});
    };
    next(0);
  }
  return { play, has: sym => !!IPA.audio[sym] };
})();
