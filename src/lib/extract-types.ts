import type { ExtractionResult } from "@/lib/schemas";

export interface ExistingMatch {
  id: string;
  title: string;
  summary: string | null;
  content: string;
}

export interface MeetingAgreement {
  id: string;
  decision: string;
  proposal: ExtractionResult;
  existing: ExistingMatch | null;
}
