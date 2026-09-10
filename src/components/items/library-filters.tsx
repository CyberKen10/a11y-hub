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

export function LibraryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const estado = searchParams.get("estado") ?? "activos";

  // Debounced search-as-you-type.
  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) params.set("q", q.trim());
      else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function onEstadoChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "activos") params.delete("estado");
    else params.set("estado", value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full max-w-sm space-y-1.5">
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
          <SelectTrigger id="library-status" className="w-44">
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
    </div>
  );
}
