import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationNav({
  page,
  pageSize,
  total,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  if (total === 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground">
        Mostrando {start}–{end} de {total}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefForPage(page - 1)}>
                <ChevronLeft aria-hidden="true" />
                Anterior
              </Link>
            </Button>
          )}
          <span className="text-sm tabular-nums">
            Página {page} de {pageCount}
          </span>
          {page >= pageCount ? (
            <Button variant="outline" size="sm" disabled>
              Siguiente
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefForPage(page + 1)}>
                Siguiente
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}
