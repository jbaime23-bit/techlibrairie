// src/components/admin/two-factor-panel.tsx
// Activation, désactivation et codes de secours de la double authentification.
"use client";

import { useState, type FormEvent } from "react";

type View =
  | { kind: "idle" }
  | { kind: "setup"; secret: string; otpauthUri: string }
  | { kind: "codes"; codes: string[]; title: string };

interface ApiResult {
  error?: string;
  secret?: string;
  otpauthUri?: string;
  recoveryCodes?: string[];
  ok?: boolean;
}

async function callApi(payload: Record<string, string>): Promise<{ ok: boolean; data: ApiResult }> {
  const response = await fetch("/api/admin/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as ApiResult;
  return { ok: response.ok, data };
}

function groupSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function TwoFactorPanel({
  enabled,
  enabledAtLabel,
  recoveryRemaining,
}: {
  enabled: boolean;
  enabledAtLabel: string | null;
  recoveryRemaining: number;
}) {
  const [view, setView] = useState<View>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [noted, setNoted] = useState(false);
  const [copied, setCopied] = useState(false);

  function resetFields() {
    setCode("");
    setPassword("");
    setError(null);
  }

  async function handleStart() {
    resetFields();
    setLoading(true);
    try {
      const { ok, data } = await callApi({ action: "start" });
      if (!ok || !data.secret || !data.otpauthUri) {
        setError(data.error ?? "Impossible de démarrer l'activation.");
      } else {
        setView({ kind: "setup", secret: data.secret, otpauthUri: data.otpauthUri });
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    }
    setLoading(false);
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { ok, data } = await callApi({ action: "confirm", code });
      if (!ok || !data.recoveryCodes) {
        setError(data.error ?? "Code incorrect.");
      } else {
        setView({
          kind: "codes",
          codes: data.recoveryCodes,
          title: "Double authentification activée",
        });
        resetFields();
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    }
    setLoading(false);
  }

  async function handleSecured(
    event: FormEvent<HTMLFormElement>,
    action: "disable" | "regenerate"
  ) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { ok, data } = await callApi({ action, password, code });
      if (!ok) {
        setError(data.error ?? "Opération refusée.");
      } else if (action === "disable") {
        window.location.reload();
        return;
      } else if (data.recoveryCodes) {
        setView({
          kind: "codes",
          codes: data.recoveryCodes,
          title: "Nouveaux codes de secours",
        });
        resetFields();
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    }
    setLoading(false);
  }

  async function copyCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (view.kind === "codes") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{view.title}</h2>

        <div className="alert-error">
          <p className="font-semibold">Notez ces codes de secours maintenant.</p>
          <p className="mt-1">
            Ils ne seront <strong>plus jamais affichés</strong>. Chacun ne sert qu&apos;une
            fois, à la place du code à 6 chiffres, si vous perdez votre téléphone.
            Conservez-les sur papier ou dans un gestionnaire de mots de passe, pas
            seulement sur ce téléphone.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-sm">
          {view.codes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <button type="button" onClick={() => copyCodes(view.codes)} className="btn-secondary">
          {copied ? "Codes copiés" : "Copier les codes"}
        </button>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={noted}
            onChange={(event) => setNoted(event.target.checked)}
            className="mt-1"
          />
          <span>J&apos;ai noté mes codes de secours dans un endroit sûr.</span>
        </label>

        <button
          type="button"
          disabled={!noted}
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Terminer
        </button>
      </div>
    );
  }

  if (view.kind === "setup") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Activer la double authentification</h2>

        <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>
            Installez une application d&apos;authentification sur votre téléphone (Google
            Authenticator, Microsoft Authenticator, Aegis, 2FAS...).
          </li>
          <li>
            Ajoutez-y ce compte :{" "}
            <a
              href={view.otpauthUri}
              className="font-semibold text-brand-700 hover:underline"
            >
              ouvrir dans mon application d&apos;authentification
            </a>{" "}
            (selon l&apos;application, le lien ne fonctionne pas toujours). Sinon, choisissez
            « saisir une clé » et entrez :
            <p className="mt-2 break-all rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-base">
              {groupSecret(view.secret)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Type de clé : basée sur l&apos;heure (TOTP), 6 chiffres, 30 secondes.
            </p>
          </li>
          <li>Saisissez ci-dessous le code à 6 chiffres affiché par l&apos;application.</li>
        </ol>

        <form onSubmit={handleConfirm} className="space-y-3" noValidate>
          {error && <div className="alert-error">{error}</div>}

          <div>
            <label htmlFor="confirm-code" className="label">
              Code à 6 chiffres
            </label>
            <input
              id="confirm-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="input max-w-[12rem]"
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={loading || code.trim().length < 6}>
              {loading ? "Vérification..." : "Activer"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={() => {
                resetFields();
                setView({ kind: "idle" });
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="space-y-4">
        {error && <div className="alert-error">{error}</div>}

        <p className="text-sm text-slate-700">
          La double authentification n&apos;est pas activée sur votre compte. Elle ajoute un
          code temporaire à votre mot de passe à chaque connexion : un mot de passe
          volé ne suffit alors plus à entrer dans l&apos;administration.
        </p>

        <button type="button" onClick={handleStart} className="btn-primary" disabled={loading}>
          {loading ? "Préparation..." : "Commencer l'activation"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <p className="font-semibold">Double authentification activée</p>
        <p className="mt-1">
          Activée le {enabledAtLabel ?? "-"}. Codes de secours restants : {recoveryRemaining}.
        </p>
        {recoveryRemaining <= 2 && (
          <p className="mt-1 font-semibold">
            Il vous reste peu de codes de secours : générez-en de nouveaux.
          </p>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}

      <form
        onSubmit={(event) => handleSecured(event, "regenerate")}
        className="space-y-3 rounded-lg border border-slate-200 p-4"
        noValidate
      >
        <h3 className="font-semibold">Générer de nouveaux codes de secours</h3>
        <p className="text-sm text-slate-600">
          Les anciens codes cessent de fonctionner. Votre mot de passe et un code actuel sont
          exigés.
        </p>
        <SecuredFields
          password={password}
          code={code}
          loading={loading}
          onPassword={setPassword}
          onCode={setCode}
          prefix="regen"
        />
        <button type="submit" className="btn-secondary" disabled={loading || !password || code.length < 6}>
          Générer de nouveaux codes
        </button>
      </form>

      <form
        onSubmit={(event) => handleSecured(event, "disable")}
        className="space-y-3 rounded-lg border border-red-200 p-4"
        noValidate
      >
        <h3 className="font-semibold text-red-800">Désactiver la double authentification</h3>
        <p className="text-sm text-slate-600">
          Votre compte redevient protégé par le seul mot de passe. Votre mot de passe et un code
          actuel sont exigés.
        </p>
        <SecuredFields
          password={password}
          code={code}
          loading={loading}
          onPassword={setPassword}
          onCode={setCode}
          prefix="disable"
        />
        <button
          type="submit"
          className="btn-secondary text-red-700"
          disabled={loading || !password || code.length < 6}
        >
          Désactiver
        </button>
      </form>
    </div>
  );
}

function SecuredFields({
  password,
  code,
  loading,
  onPassword,
  onCode,
  prefix,
}: {
  password: string;
  code: string;
  loading: boolean;
  onPassword: (value: string) => void;
  onCode: (value: string) => void;
  prefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${prefix}-password`} className="label">
          Mot de passe
        </label>
        <input
          id={`${prefix}-password`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          className="input"
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-code`} className="label">
          Code à 6 chiffres (ou code de secours)
        </label>
        <input
          id={`${prefix}-code`}
          type="text"
          autoComplete="one-time-code"
          maxLength={20}
          value={code}
          onChange={(event) => onCode(event.target.value)}
          className="input"
          disabled={loading}
        />
      </div>
    </div>
  );
}
