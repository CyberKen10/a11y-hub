"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateUserRole } from "@/lib/actions/admin";
import type { UserRole } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "reader", label: "Lector" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Administrador" },
];

export function UserRoleSelect({
  userId,
  userEmail,
  role,
  disabled,
}: {
  userId: string;
  userEmail: string;
  role: UserRole;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={role}
      disabled={disabled || pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await updateUserRole(userId, value as UserRole);
          if (result.ok) {
            toast.success(`Rol de ${userEmail} actualizado.`);
            router.refresh();
          } else {
            toast.error(result.error ?? "No se pudo actualizar.");
          }
        })
      }
    >
      <SelectTrigger
        className="w-44"
        aria-label={`Rol de ${userEmail}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
