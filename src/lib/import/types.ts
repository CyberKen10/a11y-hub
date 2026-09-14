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
