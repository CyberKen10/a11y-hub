import { describe, expect, it } from "vitest";
import {
  formatClientChatError,
  publicAiError,
  sanitizeAiError,
} from "@/lib/ai-errors";

describe("ai-errors", () => {
  it("strips API keys from messages", () => {
    const text = sanitizeAiError(
      "failed key=AIzaSyDummyKeyValue1234567890 Bearer sk-abcdefghijklmnop"
    );
    expect(text).not.toMatch(/AIzaSyDummy/);
    expect(text).not.toMatch(/sk-abcdefghijklmnop/);
    expect(text).toContain("key=***");
  });

  it("tags the stage and maps a missing Gemini key", () => {
    const message = publicAiError(
      "config",
      "Google Generative AI API key is missing"
    );
    expect(message).toContain("[configuración]");
    expect(message).toContain("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  it("explains retired Gemini 2.5 for new API keys", () => {
    const message = publicAiError(
      "generate",
      "This model models/gemini-2.5-flash is no longer available to new users."
    );
    expect(message).toContain("gemini-3.6-flash");
    expect(message).toContain("[Gemini (respuesta)]");
  });

  it("explains HTML 500 pages from Next.js", () => {
    const message = formatClientChatError(
      new Error("<!DOCTYPE html><html><body>Internal Server Error</body></html>")
    );
    expect(message.toLowerCase()).toContain("html");
    expect(message).toContain("npm run dev");
  });

  it("does not confuse the per-person daily cap with Gemini 429", () => {
    const message = publicAiError(
      "quota",
      "Has llegado al límite de 20 preguntas de chat por hoy (20/20). Se reinicia a medianoche UTC, para que una persona no se gaste el cupo gratis de Gemini de todo el equipo."
    );
    expect(message).toContain("[cupo diario]");
    expect(message).toContain("por hoy");
    expect(message).not.toContain("Espera un minuto");
  });
});
