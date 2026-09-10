"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Stores helpful / not-helpful feedback for the latest assistant message
 * matching the given content in the user's conversation.
 */
export async function submitFeedback(args: {
  conversationId: string;
  content: string;
  helpful: boolean;
}): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: message } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", args.conversationId)
    .eq("role", "assistant")
    .eq("content", args.content)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!message) return { ok: false };

  const { error } = await supabase.from("message_feedback").upsert(
    {
      message_id: message.id,
      user_id: profile.id,
      helpful: args.helpful,
    },
    { onConflict: "message_id,user_id" }
  );

  return { ok: !error };
}
