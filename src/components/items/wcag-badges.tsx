import { Badge } from "@/components/ui/badge";
import {
  formatWcagScLabel,
  getItemWcagSuccessCriteria,
  getRawWcagCp,
} from "@/lib/wcag";

export function WcagScBadges({
  metadata,
  emptyLabel = "Sin SC",
}: {
  metadata: Record<string, unknown> | null | undefined;
  emptyLabel?: string | null;
}) {
  const scs = getItemWcagSuccessCriteria(metadata);
  const raw = getRawWcagCp(metadata);

  if (scs.length > 0) {
    return (
      <ul className="flex flex-wrap gap-1" aria-label="Criterios de éxito WCAG">
        {scs.map((id) => (
          <li key={id}>
            <Badge
              variant="outline"
              className="font-mono text-[0.7rem]"
              title={raw || undefined}
            >
              {formatWcagScLabel(id)}
            </Badge>
          </li>
        ))}
      </ul>
    );
  }

  if (raw) {
    return (
      <Badge variant="outline" className="font-mono text-[0.7rem]" title={raw}>
        {raw}
      </Badge>
    );
  }

  if (!emptyLabel) return null;

  return (
    <Badge variant="outline" className="font-mono text-[0.7rem] text-muted-foreground">
      {emptyLabel}
    </Badge>
  );
}
