export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type WikiSeedSummary = ImportSummary & {
  file: string;
  queued: number;
};

export function toWikiSeedSummary(
  row: {
    file?: string;
    created?: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
    queued?: number;
  },
  file?: string
): WikiSeedSummary {
  return {
    file: file ?? row.file ?? "",
    created: row.created ?? 0,
    updated: row.updated ?? 0,
    skipped: row.skipped ?? 0,
    errors: row.errors ?? [],
    queued: row.queued ?? 0,
  };
}
