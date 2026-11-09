// src/components/auth/publishing-model-chooser.tsx
// Choix de la formule d'édition (modèle A ou B) : deux cartes avec un champ radio natif, utilisables dans
// n'importe quel formulaire (inscription, activation du profil de publication).
// Composant sans état : les montants lui sont transmis par le serveur (voir lib/publishing-models.ts).
// Fichier autonome, pas encore branché sur le site.

import type { PublishingModelTerms, PublishingModelValue } from "@/lib/publishing-models";

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function formatPercent(bps: number): string {
  return `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

export function PublishingModelChooser({
  models,
  defaultValue,
  name = "publishingModel",
  disabled = false,
  errorMessage,
}: {
  models: PublishingModelTerms[];
  defaultValue?: PublishingModelValue;
  name?: string;
  disabled?: boolean;
  errorMessage?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="label">Votre formule d&apos;édition</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {models.map((model) => (
          <label
            key={model.value}
            className="flex cursor-pointer flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
          >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name={name}
                value={model.value}
                defaultChecked={model.value === defaultValue}
                required
                disabled={disabled}
                className="mt-1"
              />
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Modèle {model.letter}
                </span>
                <span className="block text-base font-semibold">{model.label}</span>
              </span>
            </span>

            <span className="text-slate-600">{model.summary}</span>

            <ul className="space-y-1 text-slate-700">
              <li>
                <strong>À l&apos;entrée :</strong>{" "}
                {model.entryFeeXof > 0
                  ? `${formatXof(model.entryFeeXof)}, par Mobile Money`
                  : "gratuit (0 FCFA)"}
              </li>
              <li>
                <strong>Vos gains sur les ventes :</strong> {formatPercent(model.authorShareBps)}
                {model.platformShareBps === 0
                  ? " (0 % de commission pour TechLibrairie)"
                  : ` de chaque vente ; TechLibrairie conserve ${formatPercent(model.platformShareBps)}`}
              </li>
              <li>
                <strong>Livre imprimé à la demande :</strong> coût d&apos;impression et de livraison supporté par{" "}
                {model.costBearer === "AUTHOR" ? "l'auteur (déduit de ses gains)" : "TechLibrairie"}
              </li>
            </ul>
          </label>
        ))}
      </div>

      {errorMessage && <p className="field-error">{errorMessage}</p>}
    </fieldset>
  );
}
