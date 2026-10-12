// src/components/auth/reset-password-form.tsx
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/compte/reinitialiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: Record<string, string[] | undefined>;
      } | null;

      if (!response.ok) {
        setError(
          data?.fieldErrors?.password?.[0] ??
            data?.error ??
            "Une erreur est survenue. Veuillez réessayer."
        );
        setLoading(false);
        return;
      }

      setDone(true);
      setLoading(false);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.
        </div>
        <Link href="/connexion" className="btn-primary w-full">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <div className="alert-error">{error}</div>}

      <div>
        <label htmlFor="password" className="label">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-slate-500">
          8 caractères minimum, avec au moins une lettre et un chiffre.
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="input"
          disabled={loading}
        />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}
      </button>
    </form>
  );
}
