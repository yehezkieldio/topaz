"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

const SignOutForm = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await authClient.signOut();
          router.push("/library");
          router.refresh();
        });
      }}
      type="button"
      variant="secondary"
    >
      Sign out
    </Button>
  );
};

/**
 * Local credential auth (02_stack/04_auth_and_authorization.md) -- no social
 * OAuth, so a device can unlock its own library with no internet reachable.
 * `mode` decides the copy/behavior: "sign-up" only ever applies to this
 * device's very first (and only) account; every account after that signs in.
 */
const CredentialForm = ({ mode }: { mode: "sign-up" | "sign-in" }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    startTransition(async () => {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ email, name, password })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong.");
        return;
      }

      router.push("/library");
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4 text-left">
      {mode === "sign-up" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            autoComplete="name"
            id="name"
            name="name"
            required
            type="text"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete={
            mode === "sign-up" ? "new-password" : "current-password"
          }
          id="password"
          minLength={mode === "sign-up" ? MIN_PASSWORD_LENGTH : undefined}
          name="password"
          required
          type="password"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button className="w-full" disabled={isPending} type="submit">
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
};

export const AuthActionForm = ({
  hasAccount,
  isAdmin,
}: {
  hasAccount: boolean;
  isAdmin: boolean;
}) => {
  if (isAdmin) {
    return <SignOutForm />;
  }
  return <CredentialForm mode={hasAccount ? "sign-in" : "sign-up"} />;
};
