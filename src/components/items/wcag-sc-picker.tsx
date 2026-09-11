"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  compareWcagSc,
  parseWcagSuccessCriteria,
} from "@/lib/wcag";
import {
  formatWcagScOptionLabel,
  WCAG_SUCCESS_CRITERIA,
  type WcagSuccessCriterion,
} from "@/lib/wcag-catalog";

const PRINCIPLES = [
  "Perceptible",
  "Operable",
  "Comprensible",
  "Robusto",
] as const;

export function WcagScPicker({
  id,
  labelledBy,
  describedBy,
  value,
  onChange,
}: {
  id: string;
  labelledBy?: string;
  describedBy?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => parseWcagSuccessCriteria(value), [value]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const extra = useMemo(
    () => selected.filter((id) => !WCAG_SUCCESS_CRITERIA.some((sc) => sc.id === id)),
    [selected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WCAG_SUCCESS_CRITERIA;
    return WCAG_SUCCESS_CRITERIA.filter((sc) => {
      const hay = `${sc.id} ${sc.name} ${sc.level}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  function setSelected(ids: string[]) {
    const unique = [...new Set(ids)].sort(compareWcagSc);
    onChange(unique.join(", "));
  }

  function toggle(id: string, on: boolean) {
    if (on) setSelected([...selected, id]);
    else setSelected(selected.filter((x) => x !== id));
  }

  const groups = PRINCIPLES.map((principle) => ({
    principle,
    items: filtered.filter((sc) => sc.principle === principle),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="SC seleccionados">
          {selected.map((scId) => (
            <li key={scId}>
              <Badge variant="outline" className="font-mono text-[0.7rem]">
                {scId}
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => toggle(scId, false)}
                  aria-label={`Quitar SC ${scId}`}
                >
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filtrar, p. ej. 1.4.3 o contrast"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        autoComplete="off"
      />
      <fieldset
        aria-labelledby={labelledBy}
        className="max-h-56 space-y-3 overflow-y-auto rounded-lg border p-2"
      >
        <legend className="sr-only">Criterios de éxito WCAG 2.2</legend>
        {extra.length > 0 && (
          <CheckboxGroup
            heading="Ya en esta ficha"
            items={extra.map((scId) => ({
              id: scId,
              name: "valor actual",
              level: "A",
              principle: "Robusto",
            }))}
            selectedSet={selectedSet}
            onToggle={toggle}
            prefix={`${id}-extra`}
          />
        )}
        {groups.map((group) => (
          <CheckboxGroup
            key={group.principle}
            heading={group.principle}
            items={group.items}
            selectedSet={selectedSet}
            onToggle={toggle}
            prefix={id}
          />
        ))}
        {groups.length === 0 && extra.length === 0 && (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            Ningún SC coincide con “{query}”.
          </p>
        )}
      </fieldset>
    </div>
  );
}

function CheckboxGroup({
  heading,
  items,
  selectedSet,
  onToggle,
  prefix,
}: {
  heading: string;
  items: Pick<WcagSuccessCriterion, "id" | "name" | "level">[];
  selectedSet: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  prefix: string;
}) {
  return (
    <div>
      <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
        {heading}
      </p>
      <ul className="space-y-1">
        {items.map((sc) => {
          const boxId = `${prefix}-${sc.id.replace(/\./g, "-")}`;
          return (
            <li key={sc.id} className="flex items-start gap-2 px-1">
              <Checkbox
                id={boxId}
                checked={selectedSet.has(sc.id)}
                onCheckedChange={(v) => onToggle(sc.id, v === true)}
              />
              <Label htmlFor={boxId} className="font-normal leading-snug">
                {formatWcagScOptionLabel(sc.id)}
              </Label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
