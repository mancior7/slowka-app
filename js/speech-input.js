// Rozpoznawanie mowy przez wbudowany silnik przeglądarki (Web Speech API) -
// pozwala wypowiedzieć odpowiedź zamiast ją wpisywać. Działa dobrze w Chrome/Edge
// (także na Androidzie), słabiej lub wcale w Safari i w zainstalowanych apkach
// opartych o WebView - dlatego cała funkcja chowa się, gdy `supported` jest
// false, a błędy są przekazywane na wierzch (onError / onNoMatch), żeby dało się
// je zdiagnozować na telefonie.
const VocabSpeechInput = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;

  let active = null;

  // lang: kod języka OCZEKIWANEJ odpowiedzi ("pl-PL" albo "en-US"), bo to jej
  // ma słuchać silnik - przy losowym kierunku pytań zmienia się co słówko.
  function listen(lang, { onStart, onResult, onError, onNoMatch, onEnd } = {}) {
    if (!supported) {
      if (onError) onError("brak-wsparcia");
      return null;
    }
    stop();

    const rec = new SR();
    rec.lang = lang || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let gotResult = false;
    let gotError = false;

    rec.onstart = () => {
      if (onStart) onStart();
    };
    rec.onresult = (e) => {
      const text = (e.results[0] && e.results[0][0] ? e.results[0][0].transcript : "").trim();
      if (text) {
        gotResult = true;
        if (onResult) onResult(text);
      }
    };
    rec.onerror = (e) => {
      gotError = true;
      if (onError) onError(e.error || "nieznany");
    };
    rec.onend = () => {
      if (active === rec) active = null;
      // silnik potrafi zakończyć sesję bez żadnego wyniku i bez błędu (np. gdy
      // nic nie usłyszał albo mowa była za cicha) - inaczej wygląda to jakby
      // kliknięcie mikrofonu nic nie zrobiło
      if (!gotResult && !gotError && onNoMatch) onNoMatch();
      if (onEnd) onEnd();
    };

    active = rec;
    try {
      rec.start();
    } catch (err) {
      active = null;
      if (onError) onError("start: " + (err && err.message ? err.message : err));
      if (onEnd) onEnd();
      return null;
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
