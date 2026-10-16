// src/app/mentions-legales/page.tsx
import type { Metadata } from "next";
import { getContactInfo } from "@/lib/contact";
import { getLegalConfig, operatorName } from "@/lib/legal-config";
import { getPaymentMethods } from "@/lib/payment-methods";
import LegalPage, { LegalList, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales de TechLibrairie : éditeur, hébergement et contact.",
};

export const dynamic = "force-dynamic";

export default async function MentionsLegalesPage() {
  const contact = await getContactInfo();
  const legal = getLegalConfig();
  const methods = getPaymentMethods();

  return (
    <LegalPage title="Mentions légales">
      <LegalSection title="Éditeur du site">
        <LegalList>
          <li>Site : TechLibrairie, plateforme de vente de livres et guides techniques au format PDF.</li>
          <li>Exploitant : {operatorName(legal)}</li>
          {legal.address && <li>Adresse : {legal.address}</li>}
          {legal.registration && <li>Immatriculation : {legal.registration}</li>}
          {legal.director && <li>Directeur de la publication : {legal.director}</li>}
          {contact.email && (
            <li>
              Email :{" "}
              <a href={`mailto:${contact.email}`} className="font-semibold text-brand-700 hover:underline">
                {contact.email}
              </a>
            </li>
          )}
          {contact.whatsappNumber && <li>WhatsApp : +{contact.whatsappNumber}</li>}
        </LegalList>
      </LegalSection>

      <LegalSection title="Hébergement et prestataires techniques">
        <LegalList>
          <li>Hébergement du site et stockage des fichiers : Vercel Inc. (États-Unis).</li>
          <li>Base de données : Neon (infrastructure hébergée par un prestataire de cloud).</li>
          {methods.processors.length > 0 && (
            <li>
              Paiements :{" "}
              {[
                methods.mobileMoney && "Mobile Money via CinetPay",
                methods.cinetPayCard && "cartes bancaires via CinetPay",
                methods.stripeCard && "cartes bancaires via Stripe",
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </li>
          )}
          <li>Envoi des emails : Resend.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La structure, l&apos;identité visuelle et les textes propres au site sont la propriété de son
          exploitant. Les ouvrages proposés à la vente restent la propriété de leurs auteurs, éditeurs ou
          ayants droit. Toute reproduction non autorisée est interdite.
        </p>
      </LegalSection>

      <LegalSection title="Signalement d'un contenu">
        <p>
          Si vous estimez qu&apos;un ouvrage porte atteinte à vos droits ou enfreint la loi, signalez-le-nous
          par le formulaire de contact en précisant l&apos;ouvrage concerné et les raisons de votre demande.
        </p>
      </LegalSection>

      <LegalSection title="Publicité">
        <p>
          Le site affiche des publicités, dont certaines proviennent de régies publicitaires tierces
          (notamment Adsterra), chargées uniquement après votre accord. Ces régies peuvent utiliser leurs
          propres traceurs ; voir la politique de confidentialité.
        </p>
      </LegalSection>
    </LegalPage>
  );
      }
