import { ref } from 'vue';
import type { Grid } from '../types/sudoku';

export function useVisionOCR() {
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  // Runtime injektuje ključ preko .env ili konfiguracije na klijentu
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

  async function parseScreenshot(base64Data: string): Promise<Grid | null> {
    isLoading.value = true;
    error.value = null;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const prompt = "Analiziraj sliku Sudokua. Prepoznaj brojeve na mreži. Vrati dvodimenzionalni 9x9 niz cijelih brojeva pod ključem 'board', gdje je 0 prazno polje, a 1-9 su prepoznati brojevi. Vrati isključivo validan JSON koji striktno odgovara šemi.";

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: base64Data } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            board: {
              type: "ARRAY",
              description: "9x9 grid representation",
              items: {
                type: "ARRAY",
                items: { type: "INTEGER" }
              }
            }
          },
          required: ["board"]
        }
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("API Request Failed");

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(text);

      if (parsed && parsed.board && parsed.board.length === 9) {
        isLoading.value = false;
        return parsed.board as Grid;
      }

      throw new Error("Invalid grid structure from Gemini Model");
    } catch (err: any) {
      isLoading.value = false;
      error.value = err.message || "Greška tokom OCR obrade.";
      return null;
    }
  }

  return {
    isLoading,
    error,
    parseScreenshot
  };
}
