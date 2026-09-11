"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { approveApproach } from "@/lib/actions/items";
import {
  APPROVAL_LABEL,
  APPROVAL_QUORUM,
  COMPANY_FIELDS,
  WIKI_FICHA_FIELDS,
  getApprovalState,
  getApproverCount,
  listApprovers,
  userAlreadyApproved,
  type ApprovalState,
} from "@/lib/approaches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatWhen(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function ApprovalBadge({
  state,
  count,
  className,
}: {
  state: ApprovalState;
  count?: number;
  className?: string;
}) {
  const variant =
    state === "approved" ? "default" : state === "discarded" ? "destructive" : "outline";
  const extra =
    state !== "discarded" && typeof count === "number"
      ? ` · ${count} de ${APPROVAL_QUORUM}`
      : "";
  return (
    <Badge variant={variant} className={className}>
      {APPROVAL_LABEL[state]}
      {extra}
    </Badge>
  );
}

export function ApproachFicha({
  itemId,
  metadata,
  canApprove,
  currentUserId,
}: {
  itemId: string;
  metadata: Record<string, unknown>;
  canApprove: boolean;
  currentUserId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const state = getApprovalState(metadata);
  const approvers = listApprovers(metadata);
  const count = getApproverCount(metadata);
  const alreadyVoted = userAlreadyApproved(metadata, currentUserId);
  const remaining = Math.max(0, APPROVAL_QUORUM - count);
  const companyKeys = new Set<string>(COMPANY_FIELDS.map((field) => field.key));
  const fields = WIKI_FICHA_FIELDS.filter((field) => {
    if (companyKeys.has(field.key)) return false;
    const value = metadata[field.key];
    return value != null && String(value).trim() !== "";
  });

  return (
    <section aria-labelledby="ficha-wiki-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ficha-wiki-heading" className="font-bold">
          Ficha del approach
        </h2>
        <ApprovalBadge state={state} count={count} />
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-3">
        {state === "approved" ? (
          <p className="text-sm">
            Marcado como aprobado porque ya lo aprobaron{" "}
            <span className="font-medium">más de 4 personas</span> ({count}).
          </p>
        ) : state === "discarded" ? (
          <p className="text-sm">Este approach está descartado en la wiki.</p>
        ) : (
          <p className="text-sm">
            Sigue <span className="font-medium">sin aprobar</span>. Hacen falta{" "}
            <span className="font-medium">{remaining}</span> voto
            {remaining === 1 ? "" : "s"} más (más de 4 personas).
          </p>
        )}

        {approvers.length > 0 ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Ya lo aprobaron</p>
            <ul className="space-y-1 text-sm">
              {approvers.map((person) => (
                <li key={`${person.source}-${person.id ?? person.name}`}>
                  <span className="font-medium">{person.name}</span>
                  {person.at ? ` · ${formatWhen(person.at)}` : ""}
                  <span className="text-muted-foreground">
                    {person.source === "hub" ? " · hub" : " · wiki"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no hay aprobaciones registradas.
          </p>
        )}

        {canApprove && !alreadyVoted && state !== "discarded" && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await approveApproach(itemId);
                  if (result.ok) {
                    toast.success(
                      remaining <= 1
                        ? "Tu voto quedó registrado. El approach ya alcanza más de 4 aprobaciones."
                        : "Tu voto quedó registrado. El approach sigue sin aprobar hasta superar 4 personas."
                    );
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                })
              }
            >
              <CheckCircle2 aria-hidden="true" />
              {pending ? "Guardando…" : "Aprobar"}
            </Button>
          </div>
        )}

        {alreadyVoted && (
          <p className="text-sm text-muted-foreground">
            Ya registraste tu aprobación.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Por compañía</h3>
        <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPANY_FIELDS.map((field) => (
            <div key={field.key}>
              <dt className="text-sm font-medium text-muted-foreground">
                {field.label}
              </dt>
              <dd className="mt-1 text-sm">
                {metadata[field.key] != null && String(metadata[field.key]).trim() !== ""
                  ? String(metadata[field.key])
                  : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {fields.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Resto de columnas de la wiki</h3>
          <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className={field.key === "Comments" ? "sm:col-span-2" : ""}>
                <dt className="text-sm font-medium text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">
                  {String(metadata[field.key])}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
