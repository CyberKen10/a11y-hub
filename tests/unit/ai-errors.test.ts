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

  it("explains HTML 500 pages from Next.js", () => {
    const message = formatClientChatError(
      new Error("<!DOCTYPE html><html><body>Internal Server Error</body></html>")
    );
    expect(message.toLowerCase()).toContain("html");
    expect(message).toContain("npm run dev");
  });
});
