export interface DequeCheckpoint {
  scId: string;
  variant: string;
  heading: string;
  body: string;
  fileName: string;
}

export interface DequeItem {
  title: string;
  summary: string;
  content: string;
  tags: string[];
  metadata: Record<string, string>;
  status: "published";
  source_sheet_tab: string;
  source_sheet_row: number;
}
