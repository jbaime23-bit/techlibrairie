// src/components/layout/footer.tsx
import Link from "next/link";
import { buildWhatsAppLink, getContactInfo } from "@/lib/contact";
import { ContactForm } from "@/components/layout/contact-form";

export async function Footer() {
  const contact = await getContactInfo();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-page grid gap-10 py-10 lg:grid-cols-3">
        <div>
          <p className="text-xl font-bold text-brand-700">TechLibrairie</p>
          <p className="mt-2 text-sm text-slate-600">
            La plateforme multi-vendeurs de livres et guides techniques au
            format PDF. Paiement par Mobile Money ou carte bancaire,
            téléchargement immédiat.
          </p>

          <ul className="mt-4 space-y-1 text-sm">
            <li>
              <Link href="/catalogue" className="text-slate-700 hover:text-brand-700">
                Catalogue
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
        <div className="container-page py-4 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} TechLibrairie. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
