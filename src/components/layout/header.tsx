// src/components/layout/header.tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCartIds } from "@/lib/cart";
import { SignOutButton } from "@/components/layout/sign-out-button";

export async function Header() {
  const user = await getCurrentUser();
  const cartCount = (await getCartIds()).length;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
        <Link href="/" className="text-xl font-bold text-brand-700">
          TechLibrairie
        </Link>

        <nav className="flex flex-wrap items-center gap-3 text-sm font-medium">
          <Link href="/catalogue" className="text-slate-700 hover:text-brand-700">
            Catalogue
          </Link>

          <Link href="/panier" className="text-slate-700 hover:text-brand-700">
            Panier{cartCount > 0 ? ` (${cartCount})` : ""}
          </Link>

          {user ? (
            <>
              <Link href="/acheteur" className="text-slate-700 hover:text-brand-700">
                Mon espace
              </Link>

              {user.role === "SELLER" && (
                <Link href="/vendeur" className="text-slate-700 hover:text-brand-700">
                  Espace vendeur
                </Link>
              )}

              {user.role === "ADMIN" ? (
                // Lien classique (rechargement complet) : l'administration démarre
                // sur une page vierge, avec sa protection CSP.
                <a href="/admin" className="text-slate-700 hover:text-brand-700">
                  Administration
                </a>
              ) : (
                <Link href="/support" className="text-slate-700 hover:text-brand-700">
                  Support
                </Link>
              )}

              <Link href="/profil" className="text-slate-700 hover:text-brand-700">
                Mon profil
              </Link>

              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/connexion" className="btn-secondary">
                Connexion
              </Link>
              <Link href="/inscription" className="btn-primary">
                Inscription
              </Link>
            </>
          )}
        </nav>
      </div>

      {user && !user.emailVerified && (
        <div className="border-t border-yellow-200 bg-yellow-50">
          <div className="container-page py-2 text-sm text-yellow-900">
            Votre adresse email n&apos;est pas encore vérifiée.{" "}
            <Link href="/verifier-email" className="font-semibold underline">
              Vérifier maintenant
            </Link>
          </div>
        </div>
      )}
    </header>
  );
            }
