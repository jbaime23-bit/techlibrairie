// src/app/admin/emails/page.tsx
import type { Metadata } from "next";
import { firstParam, requireAdmin } from "@/lib/admin";
import { sendTestEmailAction } from "@/app/admin/emails/actions";
import { getEmailAppUrl, isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = {
  title: "Emails",
};

export const dynamic = "force-dynamic";

const EVENTS: { event: string; to: string }[] = [
  { event: "Paiement confirmé", to: "L'acheteur (liens de téléchargement) et chaque vendeur concerné" },
  { event: "Commande remboursée", to: "L'acheteur et chaque vendeur concerné" },
  { event: "Réponse de l'équipe au support", to: "L'utilisateur" },
  { event: "Nouvelle conversation de support", to: "Les administrateurs" },
  { event: "Réponse d'un utilisateur au support", to: "Les administrateurs" },
  { event: "Message du formulaire de contact", to: "Les administrateurs" },
  { event: "Versement payé ou refusé", to: "Le vendeur" },
];

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const admin = await requireAdmin("/admin/emails");

  const configured = isEmailConfigured();
  const appUrl = getEmailAppUrl();
  const from = process.env.EMAIL_FROM ?? "";

  const message = firstParam(searchParams.message);
  const error = firstParam(searchParams.erreur);
  const detail = firstParam(searchParams.detail);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Emails de notification</h1>

      {message === "envoye" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Email de test envoyé à {admin.email}. Vérifiez votre boîte de réception
          (et les courriers indésirables).
        </div>
      )}

      {error === "non-configure" && (
        <div className="alert-error">
          L&apos;envoi d&apos;emails n&apos;est pas configuré : ajoutez RESEND_API_KEY et
          EMAIL_FROM dans Vercel, puis redéployez.
        </div>
      )}

      {error === "envoi" && (
        <div className="alert-error">
          <p className="font-semibold">L&apos;envoi a échoué.</p>
          {detail && <p className="mt-1">Réponse du service : {detail}</p>}
        </div>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Configuration</h2>

        <ul className="mt-3 space-y-2 text-sm">
          <li>
            Service d&apos;envoi (Resend) :{" "}
            <strong className={configured ? "text-green-700" : "text-red-700"}>
              {configured ? "configuré" : "non configuré"}
            </strong>
          </li>
          <li>
            Expéditeur :{" "}
            {from ? <code className="rounded bg-slate-100 px-1">{from}</code> : "non défini"}
          </li>
          <li>
            Adresse du site pour les liens :{" "}
            {appUrl ? (
              <code className="rounded bg-slate-100 px-1">{appUrl}</code>
            ) : (
              <strong className="text-red-700">NEXT_PUBLIC_APP_URL manquante</strong>
            )}
          </li>
        </ul>

        <form action={sendTestEmailAction} className="mt-4">
          <button type="submit" className="btn-primary" disabled={!configured}>
            Envoyer un email de test à {admin.email}
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-500">
          Les alertes de l&apos;équipe sont envoyées à l&apos;email de contact des
          paramètres ; à défaut, aux adresses des comptes administrateurs.
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Emails envoyés automatiquement</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 pr-4 font-medium">Événement</th>
                <th className="py-2 font-medium">Destinataire</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((row) => (
                <tr key={row.event} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{row.event}</td>
                  <td className="py-2">{row.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Un email qui ne peut pas partir n&apos;empêche jamais l&apos;opération
          concernée (paiement, remboursement, versement) : l&apos;erreur est
          seulement inscrite dans les journaux Vercel.
        </p>
      </section>
    </div>
  );
            }
