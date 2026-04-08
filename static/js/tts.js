/* =========================================
   LA History — Text-to-Speech
   ========================================= */

const TTS = (() => {
  const synth = window.speechSynthesis;
  let voices = [];

  if (synth) {
    const loadVoices = () => { voices = synth.getVoices(); };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  function isSupported() {
    return !!synth;
  }

  function speak(text) {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/~/g, 'Around'));
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    const preferred = voices.find(v => v.lang === 'en-US' && /Google|Samantha|Alex/.test(v.name));
    if (preferred) utterance.voice = preferred;
    synth.speak(utterance);
  }

  function stop() {
    if (synth) synth.cancel();
  }

  function isSpeaking() {
    return synth ? synth.speaking : false;
  }

  return { isSupported, speak, stop, isSpeaking };
})();
