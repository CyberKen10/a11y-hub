export type UserRole = "admin" | "editor" | "reader";

export type ItemStatus = "draft" | "published" | "archived";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface KnowledgeType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  /** Field definitions rendered in forms and validated on save. */
  fields: KnowledgeFieldDef[];
  sort_order: number;
  created_at: string;
}

export interface KnowledgeFieldDef {
  key: string;
  label: string;
  kind: "text" | "textarea" | "url" | "list";
  required?: boolean;
  help?: string;
}

export interface KnowledgeItem {
  id: string;
  type_id: string;
  title: string;
  summary: string | null;
  content: string;
  metadata: Record<string, unknown>;
  status: ItemStatus;
  owner_id: string | null;
  source_sheet_tab: string | null;
  source_sheet_row: number | null;
  source_checksum: string | null;
  mirror_tab: string | null;
  mirror_row: number | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeItemWithType extends KnowledgeItem {
  knowledge_types: Pick<KnowledgeType, "slug" | "name" | "icon"> | null;
  tags?: Tag[];
}

export interface KnowledgeVersion {
  id: string;
  item_id: string;
  version: number;
  title: string;
  summary: string | null;
  content: string;
  metadata: Record<string, unknown>;
  status: ItemStatus;
  created_by: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface ItemRelation {
  id: string;
  from_item_id: string;
  to_item_id: string;
  relation: string;
  created_at: string;
}

export interface SourceRef {
  id: string;
  item_id: string;
  label: string;
  url: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  item_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Chunk {
  id: string;
  item_id: string;
  chunk_index: number;
  heading: string | null;
  content: string;
  token_count: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  scope_type_slug: string | null;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: RetrievedSource[] | null;
  created_at: string;
}

export interface RetrievedSource {
  index: number;
  item_id: string;
  item_title: string;
  type_slug: string | null;
  heading: string | null;
  snippet: string;
  updated_at: string | null;
  approval_state?: "approved" | "pending" | "discarded" | null;
  approval_label?: string | null;
  ficha?: string | null;
}

export type SyncJobStatus = "pending" | "running" | "done" | "failed";

export interface SyncJob {
  id: string;
  kind: "sheet_mirror" | "reindex";
  item_id: string | null;
  status: SyncJobStatus;
  attempts: number;
  last_error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}
