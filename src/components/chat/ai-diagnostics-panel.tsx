"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AiCheck, AiDiagnostics } from "@/lib/ai/types";

export function AiDiagnosticsPanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiDiagnostics | { error: string } | null>(
    null
  );

  function run() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/ai/status");
        const data = (await response.json()) as AiDiagnostics & { error?: string };
        if (!response.ok) {
          setResult({ error: data.error ?? `HTTP ${response.status}` });
          return;
        }
        setResult(data);
      } catch (error) {
        setResult({
          error: error instanceof Error ? error.message : "No se pudo llamar a /api/ai/status",
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending}>
        <Stethoscope aria-hidden="true" />
        {pending ? "Comprobando capas…" : "Diagnosticar IA"}
      </Button>
      {result && "error" in result && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Diagnóstico no disponible</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
      {result && "checks" in result && (
        <ul className="space-y-2 rounded-lg border p-3 text-sm" aria-label="Resultado del diagnóstico">
          {result.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: AiCheck }) {
  return (
    <li className="flex gap-2">
      {check.ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-label="OK" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Fallo" />
      )}
      <div>
        <p className="font-medium">{check.title}</p>
        <p className="text-muted-foreground">{check.detail}</p>
      </div>
    </li>
  );
}
