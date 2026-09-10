"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "Administrador",
  editor: "Editor",
  reader: "Lector",
};

export function UserMenu({ profile }: { profile: Profile }) {
  const initials = (profile.full_name ?? profile.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menú de usuario">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate font-medium">
            {profile.full_name ?? "Sin nombre"}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {profile.email}
          </p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            Rol: {ROLE_LABEL[profile.role]}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck aria-hidden="true" />
              Administración
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            void signOut();
          }}
        >
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
