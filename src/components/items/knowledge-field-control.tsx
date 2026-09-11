"use client";

import type { KnowledgeFieldDef } from "@/lib/types";
import { optionsWithCurrent } from "@/lib/approach-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WcagScPicker } from "@/components/items/wcag-sc-picker";

export function KnowledgeFieldControl({
  field,
  id,
  value,
  onChange,
}: {
  field: KnowledgeFieldDef;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const helpId = field.help || field.kind === "list" ? `${id}-help` : undefined;
  const labelId = `${id}-label`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} id={labelId}>
        {field.label}
      </Label>
      {field.kind === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          aria-describedby={helpId}
        />
      ) : field.kind === "select" && field.options ? (
        <Select
          value={value.trim() || undefined}
          onValueChange={onChange}
        >
          <SelectTrigger id={id} className="w-full" aria-describedby={helpId}>
            <SelectValue placeholder="Selecciona…" />
          </SelectTrigger>
          <SelectContent position="popper">
            {optionsWithCurrent(field.options, value).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.kind === "multiselect" && field.key === "CP" ? (
        <WcagScPicker
          id={id}
          labelledBy={labelId}
          describedBy={helpId}
          value={value}
          onChange={onChange}
        />
      ) : field.kind === "multiselect" && field.options ? (
        <Select
          value={value.trim() || undefined}
          onValueChange={onChange}
        >
          <SelectTrigger id={id} className="w-full" aria-describedby={helpId}>
            <SelectValue placeholder="Selecciona…" />
          </SelectTrigger>
          <SelectContent position="popper">
            {optionsWithCurrent(field.options, value).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.kind === "url" ? "url" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.kind === "select" ? undefined : field.help}
          aria-describedby={helpId}
        />
      )}
      {field.help && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {field.help}
          {field.kind === "list" ? " Valores separados por coma." : ""}
        </p>
      )}
      {!field.help && field.kind === "list" && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          Valores separados por coma.
        </p>
      )}
    </div>
  );
}
