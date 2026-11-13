"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, FormError, PasswordField, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { validateLogin, type FieldErrors } from "@/lib/validation";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const v = validateLogin({ email, password });
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  if (loading || user) return <Spinner />;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see what you owe and what you're owed."
      footer={
        <>
          New to Pocksyra?{" "}
          <Link href="/signup" className="font-medium text-emerald-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError message={formError} />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
