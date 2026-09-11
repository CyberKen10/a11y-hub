/** Turns a captions file (VTT/SRT) into readable meeting notes. */
export function transcriptToNotes(raw: string): string {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return "";

  const looksLikeCaptions =
    /^WEBVTT/i.test(text) ||
    (/^\d+\s*$/m.test(text.slice(0, 400)) &&
      /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}/.test(text));

  if (!looksLikeCaptions) return text.replace(/\r\n/g, "\n").trim();

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const spoken: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^WEBVTT/i.test(trimmed)) continue;
    if (/^NOTE\b/i.test(trimmed)) continue;
    if (/^STYLE\b/i.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/^\d{1,2}:\d{2}:\d{2}/.test(trimmed) && trimmed.includes("-->")) continue;
    if (/^kind:|^language:/i.test(trimmed)) continue;
    const clean = trimmed.replace(/<[^>]+>/g, "").trim();
    if (clean) spoken.push(clean);
  }
  return spoken.join("\n").trim();
}
