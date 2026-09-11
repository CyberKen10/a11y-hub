"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LibraryFilters({
  showApproval = false,
  wcagOptions = [],
}: {
  showApproval?: boolean;
  wcagOptions?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const estado = searchParams.get("estado") ?? "activos";
  const aprobacion = searchParams.get("aprobacion") ?? "todas";
  const scParam = searchParams.get("sc") ?? "todas";
  const sc = wcagOptions.includes(scParam) ? scParam : "todas";

  // Debounced search-as-you-type.
  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) params.set("q", q.trim());
      else params.delete("q");
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function onEstadoChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "activos") params.delete("estado");
    else params.set("estado", value);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onAprobacionChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "todas") params.delete("aprobacion");
    else params.set("aprobacion", value);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onScChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "todas") params.delete("sc");
    else params.set("sc", value);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="space-y-1.5 sm:col-span-2 lg:w-full lg:max-w-sm">
        <Label htmlFor="library-search">Buscar por título</Label>
        <Input
          id="library-search"
          type="search"
          placeholder="p. ej. auditoría WCAG"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="library-status">Estado</Label>
        <Select value={estado} onValueChange={onEstadoChange}>
          <SelectTrigger id="library-status" className="w-full lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="published">Publicados</SelectItem>
            <SelectItem value="draft">Borradores</SelectItem>
            <SelectItem value="archived">Archivados</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showApproval && (
        <div className="space-y-1.5">
          <Label htmlFor="library-approval">Aprobación</Label>
          <Select value={aprobacion} onValueChange={onAprobacionChange}>
            <SelectTrigger id="library-approval" className="w-full lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="approved">Aprobados</SelectItem>
              <SelectItem value="pending">Sin aprobar</SelectItem>
              <SelectItem value="discarded">Descartados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {wcagOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="library-wcag">SC WCAG</Label>
          <Select value={sc} onValueChange={onScChange}>
            <SelectTrigger id="library-wcag" className="w-full lg:w-44">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos</SelectItem>
              {wcagOptions.map((id) => (
                <SelectItem key={id} value={id}>
                  SC {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
