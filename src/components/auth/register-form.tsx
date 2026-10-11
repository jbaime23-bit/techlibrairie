// src/components/auth/register-form.tsx
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type AccountType = "BUYER" | "SELLER";
type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function RegisterForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("BUYER");
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    phone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch("/api/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, accountType }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: FieldErrors;
      } | null;

      if (!response.ok) {
        setGlobalError(data?.error ?? "Une erreur est survenue. Veuillez réessayer.");
        setFieldErrors(data?.fieldErrors ?? {});
        setLoading(false);
        return;
      }

      const login = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      setLoading(false);

      if (!login || login.error) {
        router.push("/connexion");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setGlobalError(
        "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez."
      );
      setLoading(false);
    }
  }

  const isSeller = accountType === "SELLER";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {globalError && <div className="alert-error">{globalError}</div>}

      <fieldset className="grid grid-cols-2 gap-3" disabled={loading}>
        <legend className="label">Type de compte</legend>

        <label
          className={`cursor-pointer rounded-lg border p-3 text-sm ${
            !isSeller
              ? "border-brand-500 bg-brand-50"
              : "border-slate-300 bg-white"
          }`}
        >
          <input
            type="radio"
            name="accountType"
            value="BUYER"
            checked={!isSeller}
            onChange={() => setAccountType("BUYER")}
            className="sr-only"
          />
          <span className="block font-semibold">Acheteur</span>
          <span className="block text-slate-600">
            J&apos;achète des livres et guides.
          </span>
        </label>

        <label
          className={`cursor-pointer rounded-lg border p-3 text-sm ${
            isSeller
              ? "border-brand-500 bg-brand-50"
              : "border-slate-300 bg-white"
          }`}
        >
          <input
            type="radio"
            name="accountType"
            value="SELLER"
            checked={isSeller}
            onChange={() => setAccountType("SELLER")}
            className="sr-only"
          />
          <span className="block font-semibold">Vendeur</span>
          <span className="block text-slate-600">
            Auteur ou éditeur, je vends mes PDF.
          </span>
        </label>
      </fieldset>
      <FieldError messages={fieldErrors.accountType} />

      <div>
        <label htmlFor="name" className="label">
          Nom complet
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={values.name}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.name} />
      </div>

      {isSeller && (
        <div>
          <label htmlFor="displayName" className="label">
            Nom d&apos;auteur ou d&apos;éditeur (affiché publiquement)
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            value={values.displayName}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.displayName} />
          <p className="mt-1 text-xs text-slate-500">
            Les PDF que vous soumettez sont publiés automatiquement sur la
            boutique. Une commission est prélevée sur chaque vente.
          </p>
        </div>
      )}

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
          value={values.email}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.email} />
      </div>

      <div>
        <label htmlFor="phone" className="label">
          Téléphone (facultatif)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+226 70 00 00 00"
          value={values.phone}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.phone} />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={values.password}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.password} />
        <p className="mt-1 text-xs text-slate-500">
          8 caractères minimum, avec au moins une lettre et un chiffre.
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={values.confirmPassword}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.confirmPassword} />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Création du compte..." : "Créer mon compte"}
      </button>
    </form>
  );
      }
