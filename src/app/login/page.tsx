import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main
      id="contenido"
      className="flex min-h-svh items-center justify-center bg-background p-6"
    >
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <p
            className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground"
            aria-hidden="true"
          >
            A
          </p>
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
