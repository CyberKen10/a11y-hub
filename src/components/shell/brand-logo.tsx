import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_ASPECT = 81 / 29;

export function BrandLogo({
  className,
  size = 36,
  alt = "A11y Solutions",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  const width = Math.round(size * LOGO_ASPECT);
  return (
    <Image
      src="/logo-a11y.png"
      alt={alt}
      width={width}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      priority
    />
  );
}
