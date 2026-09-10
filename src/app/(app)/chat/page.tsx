import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "@/components/chat/chat-client";
import type { KnowledgeType } from "@/lib/types";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("knowledge_types")
    .select("slug, name")
    .order("sort_order");

  return (
    <div className="h-[calc(100svh-8.5rem)]">
      <Suspense>
        <ChatClient
          types={(types ?? []) as Pick<KnowledgeType, "slug" | "name">[]}
        />
      </Suspense>
    </div>
  );
}
