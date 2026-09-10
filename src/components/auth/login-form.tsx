"use client";

import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initialState: AuthState = {};

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState
  );

  return (
    <Tabs defaultValue="signin">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
        <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
      </TabsList>

      <TabsContent value="signin">
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido de nuevo</CardTitle>
            <CardDescription>
              Usa tu cuenta corporativa para acceder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signInAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Correo</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Contraseña</Label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {signInState.error && (
                <p role="alert" className="text-sm text-destructive">
                  {signInState.error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={signInPending}>
                {signInPending ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="signup">
        <Card>
          <CardHeader>
            <CardTitle>Crear cuenta</CardTitle>
            <CardDescription>
              Solo correos del dominio corporativo autorizado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signUpAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nombre completo</Label>
                <Input
                  id="signup-name"
                  name="full_name"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Correo</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Contraseña</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-describedby="signup-password-help"
                />
                <p
                  id="signup-password-help"
                  className="text-xs text-muted-foreground"
                >
                  Mínimo 8 caracteres.
                </p>
              </div>
              {signUpState.error && (
                <p role="alert" className="text-sm text-destructive">
                  {signUpState.error}
                </p>
              )}
              {signUpState.message && (
                <p role="status" className="text-sm text-green-600 dark:text-green-400">
                  {signUpState.message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={signUpPending}>
                {signUpPending ? "Creando…" : "Crear cuenta"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
