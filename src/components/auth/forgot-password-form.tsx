// src/components/auth/forgot-password-form.tsx
"use client";

import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/compte/mot-de-passe-oublie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: Record<string, string[] | undefined>;
      } | null;

      if (!response.ok) {
        setError(
          data?.fieldErrors?.email?.[0] ??
            data?.error ??
            "Une erreur est survenue. Veuillez réessayer."
        );
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Si un compte existe avec cette adresse, un email vient de lui être
        envoyé avec un lien pour choisir un nouveau mot de passe. Le lien est
        valable 1 heure. Pensez à vérifier vos courriers indésirables.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <div className="alert-error">{error}</div>}

      <div>
        <label htmlFor="email" className="label">
          Adresse email de votre compte
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input"
          disabled={loading}
        />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Envoi en cours..." : "Recevoir le lien de réinitialisation"}
      </button>
    </form>
  );
}
