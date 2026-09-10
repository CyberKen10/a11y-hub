import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSheetsConfigured } from "@/lib/env";
import { ImportWizard } from "@/components/admin/import-wizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { KnowledgeType } from "@/lib/types";

export const metadata: Metadata = { title: "Importar desde Sheets" };

export default async function ImportPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("knowledge_types")
    .select("slug, name")
    .order("sort_order");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Importar desde Google Sheets
        </h1>
        <p className="text-muted-foreground">
          Trae el contenido existente al hub. Las pestañas originales solo se
          leen; el hub mantiene sus propias pestañas espejo &quot;Hub ·
          &lt;tipo&gt;&quot;.
        </p>
      </div>

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
