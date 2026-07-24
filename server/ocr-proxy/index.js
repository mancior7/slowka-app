// Google Cloud Function (Cloud Run functions, HTTP trigger) - pośredniczy między
// apką a Google Cloud Vision. Powody: (1) przeglądarki blokują bezpośrednie
// wywołanie Vision z poziomu JS (brak CORS po stronie Google), (2) klucz API nie
// trafia do kodu apki (i tym samym do publicznego repo/paczki apki) tylko zostaje
// tu, jako zmienna środowiskowa VISION_API_KEY ustawiona w konfiguracji funkcji.
import { http } from "@google-cloud/functions-framework";

const ALLOWED_ORIGIN = "https://mancior7.github.io";

http("ocrProxy", async (req, res) => {
  res.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.VISION_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Brak VISION_API_KEY w konfiguracji funkcji." });
    return;
  }

  const imageBase64 = req.body && req.body.imageBase64;
  if (!imageBase64) {
    res.status(400).json({ error: "Brak pola imageBase64 w żądaniu." });
    return;
  }

  try {
    const visionRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ image: { content: imageBase64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }],
      }),
    });

    const data = await visionRes.json();

    // Google zwraca błędy na dwa sposoby: błąd całego zapytania na najwyższym
    // poziomie (data.error - np. zły klucz, wyłączone rozliczenia, API nie
    // włączone) albo błąd pojedynczego obrazu w środku (data.responses[0].error).
    // Pierwotnie sprawdzaliśmy tylko ten drugi, więc błędy najwyższego poziomu
    // przechodziły niezauważone i kończyło się na pustym tekście.
    if (data.error) {
      res.status(502).json({ error: data.error.message || JSON.stringify(data.error) });
      return;
    }

    const result = data.responses && data.responses[0];
    const apiError = result && result.error;
    if (apiError) {
      res.status(502).json({ error: apiError.message });
      return;
    }

    // fullTextAnnotation to zwykle najlepsze pole (zachowuje układ wierszy), ale
    // jako zapasowa opcja bierzemy textAnnotations[0].description - to pole Vision
    // wypełnia praktycznie zawsze, gdy jakikolwiek tekst zostanie wykryty.
    const text =
      (result && result.fullTextAnnotation && result.fullTextAnnotation.text) ||
      (result && result.textAnnotations && result.textAnnotations[0] && result.textAnnotations[0].description) ||
      "";
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
