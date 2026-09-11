"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  CircleAlert,
  Loader2,
  MessageSquarePlus,
  SendHorizonal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { submitFeedback } from "@/lib/actions/feedback";
import { formatClientChatError } from "@/lib/ai-errors";
import { Markdown } from "@/components/items/markdown";
import { MicButton } from "@/components/chat/mic-button";
import { TtsButton } from "@/components/chat/tts-button";
import { SourcesPanel } from "@/components/chat/sources-panel";
import { AiDiagnosticsPanel } from "@/components/chat/ai-diagnostics-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KnowledgeType, RetrievedSource } from "@/lib/types";

const ALL_SCOPES = "__all__";

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function sourcesOf(message: UIMessage): RetrievedSource[] {
  const part = message.parts.find((p) => p.type === "data-sources") as
    | { type: "data-sources"; data: RetrievedSource[] }
    | undefined;
  return part?.data ?? [];
}

interface ChatDebug {
  retrieval: string;
  sourceCount: number;
  warnings: string[];
  provider?: string;
  model?: string;
}

function debugOf(message: UIMessage): ChatDebug | null {
  const part = message.parts.find((p) => p.type === "data-debug") as
    | { type: "data-debug"; data: ChatDebug }
    | undefined;
  return part?.data ?? null;
}

export function ChatClient({
  types,
}: {
  types: Pick<KnowledgeType, "slug" | "name">[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialScope = searchParams.get("scope");

  const [conversationId, setConversationId] = useState(() =>
    crypto.randomUUID()
  );
  const [scope, setScope] = useState<string>(
    initialScope && types.some((t) => t.slug === initialScope)
      ? initialScope
      : ALL_SCOPES
  );
  const [input, setInput] = useState("");
  const [seenError, setSeenError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";
  const errorText = error ? formatClientChatError(error) : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!errorText || errorText === seenError) return;
    setSeenError(errorText);
    console.error("[chat ui]", error);
    toast.error(errorText, { duration: 12000 });
  }, [errorText, seenError, error]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    void sendMessage(
      { text: trimmed },
      {
        body: {
          conversationId,
          scope: scope === ALL_SCOPES ? null : scope,
        },
      }
    );
  }

  function newConversation() {
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setInput("");
    setSeenError(null);
    router.replace("/chat");
  }

  function sendFeedback(message: UIMessage, helpful: boolean) {
    void submitFeedback({
      conversationId,
      content: textOf(message),
      helpful,
    }).then((r) => {
      if (r.ok) toast.success("Gracias por tu feedback.");
      else toast.error("No se pudo registrar el feedback.");
    });
  }

  const scopeName =
    scope === ALL_SCOPES
      ? "todo el hub"
      : types.find((t) => t.slug === scope)?.name ?? scope;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-3xl flex-col gap-3 md:gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="w-full space-y-1.5 sm:w-auto">
          <Label htmlFor="chat-scope">Alcance de la búsqueda</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="chat-scope" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SCOPES}>Todo el hub</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  Solo {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={newConversation}>
          <MessageSquarePlus aria-hidden="true" />
          Nueva conversación
        </Button>
      </div>

      <AiDiagnosticsPanel />

      {errorText && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>El chat falló en una capa concreta</AlertTitle>
          <AlertDescription>
            <p className="whitespace-pre-wrap">{errorText}</p>
            <p className="mt-2">
              Pulsa Diagnosticar IA arriba o revisa la terminal de{" "}
              <code>npm run dev</code> (líneas que empiezan por [chat · …]).
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div
        className="min-h-0 flex-1 space-y-6 overflow-y-auto rounded-2xl border bg-card p-3 text-card-foreground md:rounded-3xl md:p-4"
        role="log"
        aria-label="Conversación"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-lg font-medium">
              Pregunta lo que quieras sobre {scopeName}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Las respuestas se basan únicamente en el conocimiento publicado
              en el hub e incluyen citas verificables. Puedes escribir o dictar
              con el micrófono.
            </p>
          </div>
        )}

        {messages.map((message) => {
          const text = textOf(message);
          const sources = sourcesOf(message);
          const debug = debugOf(message);
          return (
            <article
              key={message.id}
              aria-label={
                message.role === "user" ? "Tu mensaje" : "Respuesta del asistente"
              }
            >
              {message.role === "user" ? (
                <div className="ml-auto w-fit max-w-[92%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground sm:max-w-[85%] sm:px-4 sm:py-2.5">
                  <p className="whitespace-pre-wrap">{text}</p>
                </div>
              ) : (
                <div className="max-w-[95%] space-y-1">
                  <Markdown className="prose-sm">{text}</Markdown>
                  {debug && (
                    <p className="text-xs text-muted-foreground">
                      Recuperación: {debug.retrieval} · {debug.sourceCount}{" "}
                      fuentes
                      {debug.model ? ` · ${debug.model}` : ""}
                      {debug.warnings?.length
                        ? ` · ${debug.warnings.join(" · ")}`
                        : ""}
                    </p>
                  )}
                  <SourcesPanel sources={sources} />
                  {text && status !== "streaming" && (
                    <div className="flex items-center gap-1">
                      <TtsButton text={text} />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Respuesta útil"
                        onClick={() => sendFeedback(message, true)}
                      >
                        <ThumbsUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Respuesta no útil"
                        onClick={() => sendFeedback(message, false)}
                      >
                        <ThumbsDown aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {status === "submitted" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Buscando en el hub y llamando al modelo…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="flex-1">
          <Label htmlFor="chat-input" className="sr-only">
            Escribe tu pregunta
          </Label>
          <Textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder={`Pregunta sobre ${scopeName}…`}
            rows={2}
            className="resize-none"
          />
        </div>
        <MicButton
          disabled={busy}
          onTranscript={(text) => {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || !input.trim()}
          aria-label="Enviar pregunta"
        >
          <SendHorizonal aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
