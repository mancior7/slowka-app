// Wykrywa pionową "szczelinę" (pusty odstęp) między dwiema kolumnami tekstu na
// zdjęciu i dzieli obraz na dwie części, żeby OCR czytał każdą kolumnę osobno,
// zamiast mieszać tekst z lewej i prawej strony w złej kolejności.
const VocabImageSplit = (() => {
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Nie udało się wczytać zdjęcia."));
      img.src = URL.createObjectURL(file);
    });
  }

  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // Analizuje pomniejszoną kopię obrazu (szybkie, jedno wywołanie getImageData)
  // i zwraca względną pozycję szczeliny (0-1), albo null jeśli nie znaleziono wyraźnej.
  function findGutterFraction(img) {
    const analysisWidth = Math.min(800, img.naturalWidth);
    const scale = analysisWidth / img.naturalWidth;
    const analysisHeight = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = analysisWidth;
    canvas.height = analysisHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, analysisWidth, analysisHeight);

    const { data } = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
    const threshold = 150; // luminancja poniżej = uznajemy za "atrament"
    const darkRatio = new Array(analysisWidth).fill(0);

    for (let x = 0; x < analysisWidth; x++) {
      let dark = 0;
      for (let y = 0; y < analysisHeight; y++) {
        const i = (y * analysisWidth + x) * 4;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < threshold) dark++;
      }
      darkRatio[x] = dark / analysisHeight;
    }

    // Szukamy najszerszego ciągłego "pustego" pasa w środkowej części obrazu -
    // to sam w sobie nie wystarcza (krótsza linijka tekstu też zostawia puste
    // miejsce z boku), więc dodatkowo wymagamy realnej treści po OBU stronach.
    const bandStart = Math.floor(analysisWidth * 0.3);
    const bandEnd = Math.floor(analysisWidth * 0.7);
    const emptyThreshold = 0.01;

    const runs = [];
    let runStart = null;
    for (let x = bandStart; x <= bandEnd; x++) {
      const isEmpty = darkRatio[x] < emptyThreshold;
      if (isEmpty && runStart === null) runStart = x;
      if (!isEmpty && runStart !== null) {
        runs.push([runStart, x - 1]);
        runStart = null;
      }
    }
    if (runStart !== null) runs.push([runStart, bandEnd]);
    if (runs.length === 0) return null;

    runs.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    const [gapStart, gapEnd] = runs[0];
    const gapWidth = gapEnd - gapStart + 1;
    if (gapWidth < analysisWidth * 0.015) return null;

    const contentThreshold = 0.03;
    const hasLeftContent = darkRatio.slice(0, gapStart).some((r) => r > contentThreshold);
    const hasRightContent = darkRatio.slice(gapEnd + 1).some((r) => r > contentThreshold);
    if (!hasLeftContent || !hasRightContent) return null;

    return (gapStart + gapEnd) / 2 / analysisWidth;
  }

  async function splitIfTwoColumn(file) {
    let img;
    try {
      img = await loadImage(file);
    } catch {
      return [file];
    }

    let gutterFraction = null;
    try {
      gutterFraction = findGutterFraction(img);
    } catch {
      gutterFraction = null; // np. canvas "tainted" - OCR całości jako bezpieczny fallback
    }

    if (gutterFraction === null) {
      URL.revokeObjectURL(img.src);
      return [file];
    }

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = img.naturalWidth;
    fullCanvas.height = img.naturalHeight;
    fullCanvas.getContext("2d").drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);

    const gutterX = Math.round(img.naturalWidth * gutterFraction);
    const margin = Math.round(img.naturalWidth * 0.01);

    const leftCanvas = document.createElement("canvas");
    leftCanvas.width = Math.max(1, gutterX - margin);
    leftCanvas.height = fullCanvas.height;
    leftCanvas.getContext("2d").drawImage(fullCanvas, 0, 0);

    const rightCanvas = document.createElement("canvas");
    rightCanvas.width = Math.max(1, fullCanvas.width - gutterX - margin);
    rightCanvas.height = fullCanvas.height;
    rightCanvas.getContext("2d").drawImage(fullCanvas, -(gutterX + margin), 0);

    const [leftBlob, rightBlob] = await Promise.all([toBlob(leftCanvas), toBlob(rightCanvas)]);
    return [leftBlob, rightBlob];
  }

  return { splitIfTwoColumn };
})();
