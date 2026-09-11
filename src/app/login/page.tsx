import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { BrandLogo } from "@/components/shell/brand-logo";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main
      id="contenido"
      className="flex min-h-svh items-center justify-center bg-background p-4 sm:p-6"
    >
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <BrandLogo size={56} className="mx-auto" />
          <h1 className="tracking-tight">A11y Hub</h1>
          <p className="text-sm text-muted-foreground">
            Hub interno de conocimiento de accesibilidad
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
