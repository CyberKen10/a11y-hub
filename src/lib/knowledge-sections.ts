/** Apartados que se muestran y se pueden crear. El resto se retira del hub. */
export const ACTIVE_TYPE_SLUGS = [
  "approaches",
  "metodologias",
  "herramientas",
  "plantillas",
] as const;

export type ActiveTypeSlug = (typeof ACTIVE_TYPE_SLUGS)[number];

export const ACTIVE_TYPE_SLUG_LIST: string[] = [...ACTIVE_TYPE_SLUGS];

export function isActiveTypeSlug(
  slug: string | null | undefined
): slug is ActiveTypeSlug {
  return Boolean(slug && ACTIVE_TYPE_SLUG_LIST.includes(slug));
}

/** Intersects a requested scope with the live apartados. Empty request = all live ones. */
export function resolveTypeSlugs(requested?: string[] | null): string[] {
  if (!requested || requested.length === 0) {
    return ACTIVE_TYPE_SLUG_LIST;
  }
  return requested.filter(isActiveTypeSlug);
}
