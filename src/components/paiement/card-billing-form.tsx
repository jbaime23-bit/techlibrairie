// src/components/paiement/card-billing-form.tsx
// Formulaire des informations exigées par CinetPay pour le paiement par carte.
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  COUNTRY_OPTIONS,
  STATE_REQUIRED_COUNTRIES,
} from "@/lib/billing-validation";

type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function CardBillingForm({ totalLabel }: { totalLabel: string }) {
  const [values, setValues] = useState({
    name: "",
    surname: "",
    phone: "",
    address: "",
    city: "",
    country: "BF",
    state: "",
    zipCode: "00000",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const needsState = STATE_REQUIRED_COUNTRIES.includes(values.country);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch("/api/checkout/cinetpay-carte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          state: needsState ? values.state : undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
        fieldErrors?: FieldErrors;
      } | null;

      if (!response.ok || !data?.url) {
        setGlobalError(data?.error ?? "Impossible de démarrer le paiement. Veuillez réessayer.");
        setFieldErrors(data?.fieldErrors ?? {});
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {globalError && <div className="alert-error">{globalError}</div>}

      <p className="text-xs text-slate-500">
        Ces informations sont exigées par notre prestataire de paiement pour
        accepter votre carte. Elles lui sont transmises directement et ne sont
        pas conservées par TechLibrairie.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="card-name" className="label">
            Nom
          </label>
          <input
            id="card-name"
            name="name"
            type="text"
            autoComplete="family-name"
            required
            value={values.name}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.name} />
        </div>

        <div>
          <label htmlFor="card-surname" className="label">
            Prénom
          </label>
          <input
            id="card-surname"
            name="surname"
            type="text"
            autoComplete="given-name"
            required
            value={values.surname}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.surname} />
        </div>
      </div>

      <div>
        <label htmlFor="card-phone" className="label">
          Téléphone
        </label>
        <input
          id="card-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="70 00 00 00"
          required
          value={values.phone}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.phone} />
      </div>

      <div>
        <label htmlFor="card-address" className="label">
          Adresse
        </label>
        <input
          id="card-address"
          name="address"
          type="text"
          autoComplete="street-address"
          required
          value={values.address}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.address} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="card-city" className="label">
            Ville
          </label>
          <input
            id="card-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            required
            value={values.city}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.city} />
        </div>

        <div>
          <label htmlFor="card-zip" className="label">
            Code postal
          </label>
          <input
            id="card-zip"
            name="zipCode"
            type="text"
            autoComplete="postal-code"
            maxLength={5}
            required
            value={values.zipCode}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.zipCode} />
          <p className="mt-1 text-xs text-slate-500">
            5 caractères au maximum ; 00000 si votre pays n&apos;en a pas.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="card-country" className="label">
            Pays
          </label>
          <select
            id="card-country"
            name="country"
            autoComplete="country"
            value={values.country}
            onChange={handleChange}
            className="input"
            disabled={loading}
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors.country} />
        </div>

        {needsState && (
          <div>
            <label htmlFor="card-state" className="label">
              État (2 lettres)
            </label>
            <input
              id="card-state"
              name="state"
              type="text"
              maxLength={2}
              placeholder="NY"
              required
              value={values.state}
              onChange={handleChange}
              className="input"
              disabled={loading}
            />
            <FieldError messages={fieldErrors.state} />
          </div>
        )}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Redirection vers le paiement..." : `Payer ${totalLabel} par carte bancaire`}
      </button>
    </form>
  );
}
