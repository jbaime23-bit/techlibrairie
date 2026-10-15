// src/components/auth/login-form.tsx
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        totp: needsCode ? code : "",
        redirect: false,
      });

      if (!result || result.error) {
        if (result?.error === "CODE_2FA_REQUIS") {
          setNeedsCode(true);
          setError(null);
        } else if (result?.error === "CODE_2FA_INVALIDE") {
          setNeedsCode(true);
          setError(
            "Code incorrect. Vérifiez l'heure de votre téléphone ou utilisez un code de secours."
          );
        } else if (result?.error === "TROP_DE_TENTATIVES") {
          setError(
            "Trop de tentatives échouées. Patientez 15 minutes avant de réessayer, ou utilisez « Mot de passe oublié ? »."
          );
        } else {
          setNeedsCode(false);
          setCode("");
          setError("Email ou mot de passe incorrect.");
        }
        setLoading(false);
        return;
      }

      // Rechargement complet : repart d'une page vierge (sans script publicitaire
      // éventuellement resté actif) et applique les protections de la page cible.
      window.location.assign(callbackUrl);
    } catch {
      setError(
        "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez."
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <div className="alert-error">{error}</div>}

      <div>
        <label htmlFor="email" className="label">
          Adresse email
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
          disabled={loading || needsCode}
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input"
          disabled={loading || needsCode}
        />
      </div>

      {needsCode && (
        <div>
          <label htmlFor="code" className="label">
            Code de vérification
          </label>
          <input
            id="code"
            name="code"
            type="text"
            autoComplete="one-time-code"
            autoFocus
            maxLength={20}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="input"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-slate-500">
            Saisissez le code à 6 chiffres de votre application d&apos;authentification,
            ou l&apos;un de vos codes de secours.
          </p>
        </div>
      )}

      {!needsCode && (
        <div className="text-right text-sm">
          <Link
            href="/mot-de-passe-oublie"
            className="font-semibold text-brand-700 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading
          ? "Connexion en cours..."
          : needsCode
            ? "Valider le code"
            : "Se connecter"}
      </button>

      {needsCode && (
        <button
          type="button"
          className="w-full text-center text-sm text-slate-600 hover:underline"
          onClick={() => {
            setNeedsCode(false);
            setCode("");
            setError(null);
          }}
        >
          Retour
        </button>
      )}
    </form>
  );
}
