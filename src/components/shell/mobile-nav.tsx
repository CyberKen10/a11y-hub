"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandLogo } from "@/components/shell/brand-logo";
import { NavLinks } from "@/components/shell/nav-links";
import type { KnowledgeType, UserRole } from "@/lib/types";

export function MobileNav({
  types,
  role,
}: {
  types: Pick<KnowledgeType, "slug" | "name" | "icon">[];
  role: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Abrir navegación"
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <BrandLogo size={28} />
            A11y Hub
          </SheetTitle>
        </SheetHeader>
        <NavLinks types={types} role={role} />
      </SheetContent>
    </Sheet>
  );
}
