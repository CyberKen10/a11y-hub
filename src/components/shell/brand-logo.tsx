import { cn } from "@/lib/utils";

const LOGO_ASPECT = 81 / 29;

export function BrandLogo({
  className,
  size = 24,
  alt = "A11y Solutions",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  const width = Math.round(size * LOGO_ASPECT);
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn("brand-logo shrink-0", className)}
      style={{ width, height: size }}
    />
  );
}
