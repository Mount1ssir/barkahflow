export function speak(text: string, lang: string = 'fr-FR'): void {
  if (typeof window === 'undefined') return;
  if (!window.speechSynthesis) {
    console.warn('Speech synthesis not available');
    return;
  }
  if (!text || !text.trim()) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const applyFrenchVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utterance.voice = frVoice;
    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    applyFrenchVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      applyFrenchVoice();
      window.speechSynthesis.onvoiceschanged = null;
    };
    setTimeout(() => {
      if (window.speechSynthesis.pending === false && window.speechSynthesis.speaking === false) {
        window.speechSynthesis.speak(utterance);
      }
    }, 300);
  }
}

export function cancelSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}