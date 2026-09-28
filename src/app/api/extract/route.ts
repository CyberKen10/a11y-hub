import { extractProposal } from "@/lib/actions/extract";
import { publicAiError } from "@/lib/ai-errors";

export const maxDuration = 300;

export async function POST(request: Request) {
  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text : "";
  } catch (error) {
    return Response.json(
      { ok: false, error: publicAiError("request", error) },
      { status: 400 }
    );
  }

  try {
    const result = await extractProposal(text);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return Response.json(
      { ok: false, error: publicAiError("extract", error) },
      { status: 500 }
    );
  }
}
