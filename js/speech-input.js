// Rozpoznawanie mowy przez wbudowany silnik przeglądarki (Web Speech API) -
// pozwala wypowiedzieć odpowiedź zamiast ją wpisywać. Działa dobrze w Chrome/Edge
// (także na Androidzie), słabiej lub wcale w Safari - dlatego cała funkcja chowa
// się, gdy `supported` jest false, i reszta aplikacji działa jak dawniej.
const VocabSpeechInput = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;

  let active = null;

  // lang: kod języka OCZEKIWANEJ odpowiedzi ("pl-PL" albo "en-US"), bo to jej
  // ma słuchać silnik - przy losowym kierunku pytań zmienia się co słówko.
  function listen(lang, { onResult, onError, onEnd } = {}) {
    if (!supported) return null;
    stop();

    const rec = new SR();
    rec.lang = lang || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (e) => {
      const text = (e.results[0] && e.results[0][0] ? e.results[0][0].transcript : "").trim();
      if (text && onResult) onResult(text);
    };
    rec.onerror = (e) => {
      if (onError) onError(e.error);
    };
    rec.onend = () => {
      if (active === rec) active = null;
      if (onEnd) onEnd();
    };

    active = rec;
    try {
      rec.start();
    } catch (_) {
      // start() rzuca, jeśli poprzednia sesja jeszcze nie zdążyła się zamknąć -
      // onend z tamtej i tak posprząta stan przycisku.
    }
    return rec;
  }

  function stop() {
    if (!active) return;
    try {
      active.abort();
    } catch (_) {}
    active = null;
  }

  return { supported, listen, stop };
})();
