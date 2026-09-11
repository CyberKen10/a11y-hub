import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSheetsConfigured } from "@/lib/env";
import { ImportWizard } from "@/components/admin/import-wizard";
import { WikiApproachesImport } from "@/components/admin/wiki-approaches-import";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
import type { KnowledgeType } from "@/lib/types";

export const metadata: Metadata = { title: "Importar conocimiento" };
export const maxDuration = 300;

export default async function ImportPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("knowledge_types")
    .select("slug, name")
    .in("slug", ACTIVE_TYPE_SLUG_LIST)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="tracking-tight">
          Importar conocimiento
        </h1>
        <p className="text-muted-foreground">
          La base de Approaches es el Excel Wiki. Google Sheets solo se usa
          como espejo: las pestañas originales se leen; el hub escribe en
          &quot;Hub · &lt;tipo&gt;&quot;.
        </p>
      </div>

      <WikiApproachesImport />

      {!isSheetsConfigured() && (
        <Alert>
          <AlertTitle>Google Sheets no está configurado</AlertTitle>
          <AlertDescription>
            Define GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY y
            GOOGLE_SHEET_ID en las variables de entorno, y comparte el Sheet
            con el correo de la cuenta de servicio.
          </AlertDescription>
        </Alert>
      )}

      <ImportWizard
        types={(types ?? []) as Pick<KnowledgeType, "slug" | "name">[]}
      />
    </div>
  );
}
