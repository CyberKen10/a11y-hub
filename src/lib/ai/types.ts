export interface AiCheck {
  id: string;
  ok: boolean;
  title: string;
  detail: string;
}

export interface AiDiagnostics {
  ok: boolean;
  checks: AiCheck[];
}
