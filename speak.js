// Speaks words and phrases with eSpeak NG (vendor/espeak-ng), from their IPA.
//
// eSpeak doesn't read IPA directly: it takes its own phoneme names inside [[ ]], and each voice knows a
// different set of phonemes. So for each phrase we pick the voice that knows the most of its sounds
// (speak-data.js lists, per voice, the phoneme name for each IPA symbol), and replace any sound the voice
// lacks with the closest one it has (SIMILAR below). The engine (about 12 MB) loads on first use.
const Speech = (() => {
  // Closest substitute for a sound, tried in turn until the voice has one.
  const SIMILAR = {
    'ɱ': 'm', 'ʙ': 'b', 'ⱱ': 'v', 'ɦ': 'h', 'ɮ': 'l', 'ɰ': 'ɯ', 'ʟ': 'l', 'ɥ': 'j', 'ʜ': 'h', 'ʢ': 'ʕ', 'ʡ': 'ʔ',
    'ɺ': 'l', 'ɧ': 'ʃ', 'ʘ': 'p', 'ǀ': 't', 'ǃ': 'k', 'ǂ': 'c', 'ǁ': 'l', 'ɓ': 'b', 'ɗ': 'd', 'ʄ': 'ɟ', 'ɠ': 'ɡ',
    'ʛ': 'ɢ', 'pʼ': 'p', 'tʼ': 't', 'kʼ': 'k', 'sʼ': 's', 'ʏ': 'y', 'ɞ': 'œ', 'ɶ': 'œ', 'ʈ': 't', 'ɖ': 'd',
    'ɴ': 'ŋ', 'ɽ': 'ɾ', 'ɸ': 'f', 'ħ': 'h', 'ʕ': 'h', 'ɹ': 'r', 'ɻ': 'ɹ', 'ʍ': 'w', 'ɨ': 'i', 'ʉ': 'u', 'ɘ': 'ə',
    'ɵ': 'ø', 'ɤ': 'o', 'ɜ': 'ə', 'ʌ': 'a', 'ɐ': 'a', 'ɒ': 'ɔ', 'ɯ': 'u', 'ç': 'ʃ', 'ʝ': 'j', 'ɢ': 'ɡ', 'q': 'k',
    'χ': 'x', 'ʁ': 'r', 'x': 'h', 'ɣ': 'ɡ', 'β': 'b', 'θ': 'f', 'ð': 'd', 'ʒ': 'ʃ', 'ʃ': 's', 'ɕ': 'ʃ', 'ʑ': 'ʒ',
    'ʂ': 'ʃ', 'ʐ': 'ʒ', 'œ': 'ø', 'ø': 'e', 'y': 'i', 'ɛ': 'e', 'ɔ': 'o', 'æ': 'a', 'ə': 'e', 'ɪ': 'i', 'ʊ': 'u',
    'ɑ': 'a', 'ɾ': 'r', 'ʎ': 'l', 'ɲ': 'n', 'ŋ': 'n', 'c': 'k', 'ɟ': 'ɡ', 'g': 'ɡ', 'ʋ': 'v', 'ɬ': 'l', 'ʀ': 'r',
  };
  const PAUSE = /[.,!?;:…]/;

  // The phoneme name for an IPA symbol in a voice, or null. Affricates and other clusters fall back to their parts.
  function name(sym, table) {
    for (let s = sym, i = 0; s && i < 6; s = SIMILAR[s], i++) if (table[s]) return table[s];
    if ([...sym].length > 1) {
      const parts = [...sym].map(c => name(c, table));
      return parts.every(Boolean) ? parts.join('|') : null;
    }
    return null;
  }

  // Turn text into eSpeak input for the voice that covers it best: [[...]] per word, punctuation kept for pauses.
  function plan(text, inventory) {
    const words = Parse.words(text).map(w => w.word
      ? Parse.segment(w.text, inventory).flatMap(s => s.symbols || (s.unknown ? [s.text.toLowerCase()] : []))
      : w.text);
    const needed = [...new Set(words.filter(Array.isArray).flat())];
    if (!needed.length) return null;
    let voice = 'en', best = -1;
    for (const [v, table] of Object.entries(SpeakData)) {
      const score = needed.filter(s => table[s]).length * 10 + needed.filter(s => name(s, table)).length;
      if (score > best) { best = score; voice = v; }
    }
    const table = SpeakData[voice];
    const input = words.map(w => {
      if (!Array.isArray(w)) return PAUSE.test(w) ? w.replace(/[^.,!?;:…]/g, '') + ' ' : ' ';
      const names = w.map(s => name(s, table)).filter(Boolean);
      return names.length ? `[[${names.join('|')}]]` : '';
    }).join('').trim();
    return input ? { voice, input } : null;
  }

  // ---------- The engine ----------
  let engine = null;
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  function load() {
    return engine ||= (async () => {
      await loadScript('vendor/espeak-ng/espeak-ng.js');
      await loadScript('vendor/espeak-ng/espeak-ng-wasm.js');
      const gz = Uint8Array.from(atob(window.ESPEAK_WASM_GZ_B64), c => c.charCodeAt(0));
      delete window.ESPEAK_WASM_GZ_B64;
      const bytes = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      return WebAssembly.compile(bytes);
    })().catch(err => { engine = null; throw err; });
  }

  // Render to a WAV with a fresh instance of the engine (it runs like a command line program).
  async function wav(voice, input) {
    const compiled = await load();
    const m = await window.ESpeakNG({
      arguments: ['-v', voice, '-w', '/out.wav', input],
      print: () => {}, printErr: () => {},
      instantiateWasm: (imports, done) => { WebAssembly.instantiate(compiled, imports).then(done); return {}; },
    });
    return new Blob([m.FS.readFile('/out.wav')], { type: 'audio/wav' });
  }

  let audio = null, lit = null;
  const unlight = () => { lit?.classList.remove('playing', 'loading'); lit = null; };
  async function say(text, inventory, el) {
    audio?.pause(); unlight();
    const p = plan(text, inventory);
    if (!p) return;
    lit = el; el?.classList.add('loading');
    try {
      const blob = await wav(p.voice, p.input);
      if (lit !== el) return; // something else started meanwhile
      el?.classList.replace('loading', 'playing');
      audio = new Audio(URL.createObjectURL(blob));
      audio.onended = audio.onerror = () => { URL.revokeObjectURL(audio.src); if (lit === el) unlight(); };
      await audio.play();
    } catch (err) {
      console.error(err);
      if (lit === el) unlight();
    }
  }

  return { say, plan };
})();
