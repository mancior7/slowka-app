# WordSnap — nauka angielskich słówek ze zdjęcia

PWA (Progressive Web App) do nauki angielskiego słownictwa. Robisz zdjęcie listy słówek
(np. z zeszytu albo podręcznika), aplikacja odczytuje tekst (OCR), a potem przepytuje Cię
z tych słówek na kilka sposobów, z powtórkami rozłożonymi w czasie (SRS).

**Live**: https://mancior7.github.io/slowka-app/
**Repo**: https://github.com/mancior7/slowka-app (publiczne)
**Konto GitHub**: mancior7, zalogowane lokalnie przez `gh` CLI (`C:\Program Files\GitHub CLI`)

## Stack

Czysty HTML/CSS/JS (bez frameworków, bez build toola) + Tesseract.js (OCR, ładowany z CDN)
w pełni po stronie klienta. Dane trzymane w `localStorage` telefonu/przeglądarki — **brak
backendu i kont użytkownika** (patrz sekcja "Co dalej" niżej — to świadoma, na razie nie
podjęta decyzja).

## Struktura plików

```
slowka-app/
  index.html            # jedna strona, wiele "ekranów" (divy) przełączanych przez JS
  manifest.json          # PWA manifest (nazwa WordSnap, ikony, kolory)
  sw.js                   # service worker: cache "network-first" z cache:"no-store"
  css/style.css            # wszystkie style, zmienne CSS dla jasnego/ciemnego motywu
  js/
    app.js                  # routing ekranów, obsługa zdarzeń, cała logika UI
    storage.js               # localStorage: talie/słówka/stan SRS (VocabStorage)
    srs.js                    # algorytm powtórek SM-2-lite (VocabSRS)
    parser.js                  # tekst (OCR/wklejony) -> pary {en, pl} (VocabParser)
    imagesplit.js                # wykrywanie i dzielenie zdjęcia na dwie kolumny tekstu
    ocr.js                        # wrapper na Tesseract.js (worker, PSM.SINGLE_COLUMN)
    quiz.js                        # logika sesji (4 tryby), sprawdzanie odpowiedzi (VocabQuiz)
    stats.js                        # statystyki nauki (VocabStats)
  icons/icon.svg                    # ikona appki (motyw aparatu/kadru)
```

## Funkcje

### Talie słówek
- Tworzenie: wklejony tekst (`słówko - tłumaczenie`) albo zdjęcie (OCR)
- OCR automatycznie: wykrywa i dzieli dwie kolumny tekstu (żeby nie mieszać kolejności),
  wycina transkrypcję fonetyczną `/w ukośnikach/`, czyści śmieciowe symbole (©, | — to
  zwykle błędnie odczytane ikonki poziomu trudności w podręcznikach)
- Ekran przeglądu/edycji przed zapisem — zawsze można poprawić/usunąć/dodać wiersz
- Po utworzeniu: można zmienić nazwę i dodać/usunąć/edytować słówka (przycisk
  "✎ Edytuj nazwę i słówka" w ustawieniach talii) — edycja zachowuje stan powtórek (SRS)
  dla niezmienionych słówek

### Tryby nauki (4)
1. **Test pisany** — jedno pytanie na raz, wpisujesz odpowiedź
2. **Fiszki** — odkrywasz odpowiedź, sam oceniasz "znałem/nie znałem"
3. **Quiz ABCD** — wybór z 4 opcji
4. **Zbiorczo** — wszystkie słówka naraz, wypełniasz wszystkie pola i sprawdzasz jednym
   kliknięciem; wynik pokazuje ✓/✗ i przy błędnych "Napisałeś: X" (styl jak w ChatGPT).
   Ma własny wybór kierunku: Losowo (domyślnie, język zmienia się dla każdego słówka
   osobno z etykietą → EN/→ PL), PL→EN, EN→PL

Wspólne dla trybów: wybór kolejności (losowo/po kolei), liczba powtórzeń całej partii
(1-5 rund, tylko tryby inne niż zbiorczy). Sesja zawsze obejmuje **wszystkie** słówka
talii (bez sztywnego limitu). Błędna odpowiedź wraca w tej samej sesji, max 3 próby na
słówko (żeby sesja nie trwała w nieskończoność przy słówku, którego ktoś nie zna).

Sprawdzanie odpowiedzi: ignoruje wielkość liter i polskie znaki diakrytyczne, toleruje
literówki (dystans Levenshteina), uznaje dowolny z synonimów po przecinku i wariant
z/bez dopowiedzenia w nawiasie jako poprawny.

### Statystyki (przycisk 📊)
Łączny czas nauki, liczba przerobionych słówek, passa dni z rzędu, skuteczność %,
wykres słupkowy ostatnich 7 dni. Zbiera się automatycznie po każdej sesji.

### Inne
- Motyw jasny/ciemny (🌙/☀️) — domyślnie system, wybór zapamiętywany
- PWA: instalowalna na ekran główny, działa offline (poza pierwszym użyciem OCR, które
  ściąga dane językowe Tesseract z internetu)
- Ekran powitalny "Welcome to WordSnap" przy starcie (animacja ~1,5s)

## Ważne informacje techniczne (dla przyszłych sesji)

**Cache/aktualizacje**: `sw.js` używa strategii "najpierw sieć" z jawnym
`cache: "no-store"` (żeby ominąć też zwykły cache HTTP przeglądarki, nie tylko Cache
Storage API) — to było potrzebne, bo sama strategia "network-first" bez tego nadal
potrafiła serwować stare pliki. Mimo to przy wielokrotnym testowaniu tego samego adresu
w krótkim czasie (ten sam port/origin odwiedzany dziesiątki razy) potrafi się utrzymać
stary cache — działającym obejściem przy lokalnym testowaniu jest **zmiana portu serwera
testowego** (nowy port = nowe origin = czysty stan), a przy testowaniu na GitHub Pages —
doklejenie parametru cache-bustującego do URL-a (`?cb=...`) albo `fetch(url,
{cache:'no-store'})` zamiast polegać na zwykłej nawigacji.

**Wdrażanie**: edytuj pliki lokalnie → przetestuj (python http.server na świeżym porcie)
→ `git add -A && git commit -m "..." && git push` (repo nie ma ustawionego globalnie
`user.email`/`user.name`, więc trzeba dodać `-c user.email=... -c user.name=...` do
komend gita, albo ustawić je lokalnie w repo) → GitHub Pages przebudowuje się
automatycznie (zwykle 30-90 sekund).

## Co dalej (przedyskutowane, ale NIE zrobione)

- **Konta użytkownika / synchronizacja w chmurze** — żeby dane przetrwały odinstalowanie
  appki. Rekomendacja: Firebase Auth + Firestore (darmowy pakiet w zupełności wystarczy na
  osobisty użytek). Wymaga założenia konta Google Cloud/Firebase. Użytkownik na razie
  tylko pytał, nie zdecydował się zaczynać.
- **Wymowa na głos (🔊)** — Web Speech API (`speechSynthesis`), wbudowane w przeglądarki,
  darmowe, bez nowych kont. Niezrobione na wyraźną prośbę ("na razie tylko pytam").
- **Płynniejsze animacje UI** (przejścia między ekranami mniej "mechaniczne") — do zrobienia
  w CSS/JS, nie wymaga zmian architektury. Niezrobione na wyraźną prośbę.
- **Lepszy OCR** — użytkownik zgłasza, że nadal często musi ręcznie poprawiać większość
  słówek ze zdjęcia. Dwie opcje do rozważenia: (A) dodać przetwarzanie zdjęcia przed OCR
  (powiększenie + kontrast/binaryzacja) — darmowe, bez kont; (B) przejście na Google Cloud
  Vision API — zauważalnie lepsza jakość, darmowy limit ok. 1000 zdjęć/mies., ale wymaga
  konta Google Cloud i klucza API. **Użytkownik nie wybrał jeszcze opcji — do ustalenia
  w kolejnej rozmowie.**

## Inne, niepowiązane projekty z tej samej sesji (nieaktywne, dla kontekstu)

- Porównywarka cen części samochodowych (Allegro API + scraper Ceneo.pl) —
  `C:\Users\Patryk-PC\Downloads\Telegram Desktop\CLAUDE\`. Działający V1, ale dane
  logowania do Allegro API nigdy nie zostały skonfigurowane (użytkownik był ostrożny
  co do udostępniania sekretów).
- Strona internetowa salonu fryzjerskiego ("VELVET") —
  `C:\Users\Patryk-PC\Desktop\salon-fryzjerski\`. Zbudowana i ostylowana, ale nigdzie nie
  wdrożona (tylko lokalnie).
