// src/components/layout/footer.tsx
import Link from "next/link";
import { buildWhatsAppLink, getContactInfo } from "@/lib/contact";
import { ContactForm } from "@/components/layout/contact-form";
import { CookieSettingsButton } from "@/components/legal/cookie-settings-button";
import { getPaymentMethods, paymentSummary } from "@/lib/payment-methods";

// Liens des réseaux sociaux : variables facultatives de Vercel. Seuls les liens renseignés sont affichés.
const SOCIAL_LINKS: { label: string; value: string | undefined }[] = [
  { label: "Facebook", value: process.env.NEXT_PUBLIC_FACEBOOK_URL },
  { label: "Instagram", value: process.env.NEXT_PUBLIC_INSTAGRAM_URL },
  { label: "YouTube", value: process.env.NEXT_PUBLIC_YOUTUBE_URL },
  { label: "TikTok", value: process.env.NEXT_PUBLIC_TIKTOK_URL },
  { label: "X", value: process.env.NEXT_PUBLIC_X_URL },
  { label: "LinkedIn", value: process.env.NEXT_PUBLIC_LINKEDIN_URL },
  { label: "Telegram", value: process.env.NEXT_PUBLIC_TELEGRAM_URL },
];

/** Accepte uniquement une adresse https valide (aucune adresse de type javascript:). */
function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function Footer() {
  const contact = await getContactInfo();
  const summary = paymentSummary(getPaymentMethods());

  const socials = SOCIAL_LINKS.map((item) => ({
    label: item.label,
    href: safeHttpsUrl(item.value),
  })).filter((item): item is { label: string; href: string } => item.href !== null);

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-page grid gap-10 py-10 lg:grid-cols-3">
        <div>
          <p className="text-xl font-bold text-brand-700">TechLibrairie</p>
          <p className="mt-2 text-sm text-slate-600">
            La plateforme multi-vendeurs de livres et guides techniques au
            format PDF. {summary}, téléchargement immédiat.
          </p>

          <ul className="mt-4 space-y-1 text-sm">
            <li>
              <Link href="/catalogue" className="text-slate-700 hover:text-brand-700">
                Catalogue
              </Link>
            </li>
            <li>
              <Link href="/gratuit" className="text-slate-700 hover:text-brand-700">
                Téléchargements gratuits
              </Link>
            </li>
            <li>
              <Link href="/a-propos" className="text-slate-700 hover:text-brand-700">
                À propos
              </Link>
            </li>
            <li>
              <Link href="/inscription" className="text-slate-700 hover:text-brand-700">
                Devenir vendeur
              </Link>
            </li>
            <li>
              <Link href="/connexion" className="text-slate-700 hover:text-brand-700">
                Connexion
              </Link>
            </li>
          </ul>

          {socials.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-700">Suivez-nous</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div id="contact">
          <h2 className="text-lg font-semibold">Contact</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {contact.email && (
              <li>
                <span className="block text-slate-500">Email</span>
                <a
                  href={`mailto:${contact.email}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {contact.email}
                </a>
              </li>
            )}

            {contact.whatsappNumber && (
              <li>
                <span className="block text-slate-500">WhatsApp</span>
                <a
                  href={buildWhatsAppLink(
                    contact.whatsappNumber,
                    "Bonjour TechLibrairie, j'ai une question."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
                >
                  Discuter sur WhatsApp
                </a>
              </li>
            )}

            {!contact.email && !contact.whatsappNumber && (
              <li className="text-slate-500">
                Utilisez le formulaire pour nous écrire.
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Écrivez-nous</h2>
          <div className="mt-3">
            <ContactForm />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="container-page flex flex-col items-center gap-2 py-4 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} TechLibrairie. Tous droits réservés.</p>
          <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-4">
            <Link href="/conditions" className="hover:text-brand-700">
              Conditions générales
            </Link>
            <Link href="/mentions-legales" className="hover:text-brand-700">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="hover:text-brand-700">
              Confidentialité
            </Link>
            <CookieSettingsButton />
          </nav>
        </div>
      </div>
    </footer>
  );
}
