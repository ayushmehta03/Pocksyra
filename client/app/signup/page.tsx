"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, FormError, PasswordField, PasswordStrength, Spinner } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { validateSignup, type FieldErrors } from "@/lib/validation";

export default function SignupPage() {
  const { user, loading, signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [key]: key === "username" ? e.target.value.toLowerCase().replace(/\s/g, "") : e.target.value,
    }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const v = validateSignup(form);
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      await signup({ ...form, name: form.name.trim(), email: form.email.trim() });
      router.replace("/dashboard");
    } catch (err) {
      // Map backend conflicts onto the right field.
      if (err instanceof ApiError && err.status === 409) {
        const field = err.message.toLowerCase().includes("username") ? "username" : "email";
        setErrors({ [field]: err.message });
      } else {
        setFormError(errorMessage(err));
      }
      setSubmitting(false);
    }
  }

  if (loading || user) return <Spinner />;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start splitting expenses in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-jade-700 underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError message={formError} />
        <Field
          label="Full name"
          autoComplete="name"
          placeholder="Ayush Mehta"
          value={form.name}
          onChange={set("name")}
          error={errors.name}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set("email")}
          error={errors.email}
        />
        <Field
          label="Username"
          autoComplete="username"
          placeholder="ayush_m"
          value={form.username}
          onChange={set("username")}
          error={errors.username}
          hint="Friends can find you by this. Letters, numbers, underscore."
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          hint={form.password ? undefined : "At least 8 characters."}
        />
        <PasswordStrength password={form.password} />
        <Button type="submit" loading={submitting} arrow className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
