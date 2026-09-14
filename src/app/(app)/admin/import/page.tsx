import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { isGoogleAuthConfigured } from "@/lib/google/sheets";
import { ImportWizard } from "@/components/admin/import-wizard";
import { WikiApproachesImport } from "@/components/admin/wiki-approaches-import";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Importar conocimiento" };
export const maxDuration = 300;

export default async function ImportPage() {
  await requireProfile("admin");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="tracking-tight">Importar conocimiento</h1>
        <p className="text-muted-foreground">
          Sube un Excel o pega el enlace de un Google Sheet. Las fichas entran
          al hub; el chat se actualiza en Sincronización.
        </p>
      </div>

      <WikiApproachesImport />

      {!isGoogleAuthConfigured() && (
        <Alert>
          <AlertTitle>Google Sheets no está configurado</AlertTitle>
          <AlertDescription>
            Para importar por enlace, define GOOGLE_SERVICE_ACCOUNT_EMAIL y
            GOOGLE_PRIVATE_KEY, y comparte el Sheet con ese correo como Lector.
          </AlertDescription>
        </Alert>
      )}

      <ImportWizard />
    </div>
  );
}
