// Wymowa na głos przez wbudowany silnik przeglądarki (Web Speech API) -
// bez kont, kluczy czy kosztów, działa też offline na większości urządzeń.
const VocabSpeech = (() => {
  function speak(text, lang = "en-US") {
    if (!text || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    speechSynthesis.speak(utterance);
  }

  return { speak };
})();
