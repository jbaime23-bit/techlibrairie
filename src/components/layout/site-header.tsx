// src/components/layout/site-header.tsx
// En-tête adaptatif : deux sections (Édition, prioritaire, et Boutique) avec chacune son sous-menu et sa
// couleur ; menu déroulant sur téléphone ; menu du compte selon le rôle.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/layout/sign-out-button";

type Section = "edition" | "boutique";

export interface HeaderUser {
  name: string | null;
  role: "BUYER" | "SELLER" | "ADMIN";
  verified: boolean;
}

interface NavItem {
  href: string;
  label: string;
  // Lien classique (rechargement complet), pour l'administration et sa protection
  external?: boolean;
}

const BOUTIQUE_PREFIXES = [
  "/boutique",
  "/catalogue",
  "/gratuit",
  "/panier",
  "/paiement",
  "/acheteur",
  "/favoris",
  "/auteurs",
  "/commander-imprime",
  "/vendeur",
];

// Ces pages de l'espace vendeur appartiennent au suivi des éditions.
const EDITION_OVERRIDES = ["/vendeur/publication", "/vendeur/impression"];

function sectionOf(pathname: string): Section {
  if (EDITION_OVERRIDES.some((prefix) => pathname.startsWith(prefix))) return "edition";

  const inBoutique = BOUTIQUE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return inBoutique ? "boutique" : "edition";
}

function accountLinks(user: HeaderUser): NavItem[] {
  const links: NavItem[] = [];

  if (user.role === "ADMIN") {
    links.push({ href: "/admin", label: "Administration", external: true });
  }
  if (user.role === "SELLER" || user.role === "ADMIN") {
    links.push({ href: "/edition/espace", label: "Mon espace auteur" });
    links.push({ href: "/vendeur", label: "Espace vendeur (boutique)" });
    links.push({ href: "/vendeur/produits", label: "Mes livres et documents" });
  }

  links.push({ href: "/acheteur", label: "Mes achats" });
  links.push({ href: "/acheteur/impression", label: "Mes livres imprimés" });
  links.push({ href: "/favoris", label: "Mes favoris" });
  links.push({ href: "/profil", label: "Mon profil" });

  if (user.role !== "ADMIN") {
    links.push({ href: "/support", label: "Support" });
  }

  return links;
}

function ItemLink({
  item,
  className,
}: {
  item: NavItem;
  className: string;
}) {
  if (item.external) {
    return (
      <a href={item.href} className={className}>
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

export function SiteHeader({
  user,
  cartCount,
}: {
  user: HeaderUser | null;
  cartCount: number;
}) {
  const pathname = usePathname() ?? "/";
  const section = sectionOf(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Les menus se referment à chaque changement de page.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const isAuthorSpace = user !== null && (user.role === "SELLER" || user.role === "ADMIN");

  const subNav: NavItem[] =
    section === "edition"
      ? [
          { href: "/edition#formules", label: "Nos formules" },
          { href: "/edition#etapes", label: "Comment ça marche" },
          { href: "/edition/deposer", label: "Déposer mon manuscrit" },
          { href: "/contrat-edition", label: "Le contrat" },
          isAuthorSpace
            ? { href: "/edition/espace", label: "Mon espace auteur" }
            : { href: "/edition/connexion", label: "Espace auteur" },
        ]
      : [
          { href: "/boutique", label: "La boutique" },
          { href: "/catalogue", label: "Catalogue" },
          { href: "/gratuit", label: "PDF gratuits" },
          ...(isAuthorSpace ? [{ href: "/vendeur", label: "Espace vendeur" }] : []),
          ...(user ? [{ href: "/acheteur", label: "Mes achats" }] : []),
        ];

  const isEdition = section === "edition";
  const subBarClass = isEdition
    ? "border-brand-100 bg-brand-50 text-brand-800"
    : "border-teal-100 bg-teal-50 text-teal-800";
  const initial = (user?.name ?? "").trim().charAt(0).toUpperCase() || "?";

  const tabClass = (active: boolean, tone: "brand" | "teal") =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      active
        ? tone === "brand"
          ? "bg-brand-600 text-white shadow-sm"
          : "bg-teal-700 text-white shadow-sm"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  const cartLabel = `Panier${cartCount > 0 ? ` (${cartCount})` : ""}`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-page flex items-center justify-between gap-3 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-500 text-lg font-extrabold text-white shadow-soft">
            T
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-extrabold text-brand-900">TechLibrairie</span>
            <span className="block text-[11px] font-bold uppercase tracking-widest text-accent-600">
              Édition
            </span>
          </span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          <Link href="/edition" className={tabClass(isEdition, "brand")}>
            Édition
          </Link>
          <Link href="/boutique" className={tabClass(!isEdition, "teal")}>
            Boutique
          </Link>
          <Link
            href="/a-propos"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            À propos
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {!isEdition && (
            <Link
              href="/panier"
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              {cartLabel}
            </Link>
          )}

          <Link href="/edition/deposer" className="btn-accent hidden px-4 py-2 sm:inline-flex">
            Déposer un manuscrit
          </Link>

          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {user ? (
                <>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {initial}
                  </span>
                  <span className="max-w-[8rem] truncate">{user.name ?? "Mon compte"}</span>
                </>
              ) : (
                "Mon compte"
              )}
              <span aria-hidden="true" className="text-xs">
                ▾
              </span>
            </button>

            {accountOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-soft">
                {user ? (
                  <>
                    {accountLinks(user).map((item) => (
                      <ItemLink
                        key={item.href}
                        item={item}
                        className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-brand-50"
                      />
                    ))}
                    <div className="mt-1 border-t border-slate-100 px-1 pt-2">
                      <SignOutButton />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="px-3 pt-1 text-xs font-bold uppercase tracking-widest text-brand-700">
                      Édition
                    </p>
                    <Link href="/edition/connexion" className="block rounded-xl px-3 py-2 text-sm hover:bg-brand-50">
                      Connexion auteur
                    </Link>
                    <Link href="/edition/inscription" className="block rounded-xl px-3 py-2 text-sm hover:bg-brand-50">
                      Créer un compte auteur
                    </Link>
                    <p className="px-3 pt-2 text-xs font-bold uppercase tracking-widest text-teal-700">
                      Boutique
                    </p>
                    <Link href="/boutique/acheteur/connexion" className="block rounded-xl px-3 py-2 text-sm hover:bg-teal-50">
                      Connexion acheteur
                    </Link>
                    <Link href="/boutique/acheteur/inscription" className="block rounded-xl px-3 py-2 text-sm hover:bg-teal-50">
                      Créer un compte acheteur
                    </Link>
                    <Link href="/boutique/vendeur/connexion" className="block rounded-xl px-3 py-2 text-sm hover:bg-teal-50">
                      Connexion vendeur
                    </Link>
                    <Link href="/boutique/vendeur/inscription" className="block rounded-xl px-3 py-2 text-sm hover:bg-teal-50">
                      Créer un compte vendeur
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Ouvrir le menu"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 md:hidden"
          >
            {menuOpen ? "Fermer" : "Menu"}
          </button>
        </div>
      </div>

      <div className={`hidden border-t ${subBarClass} md:block`}>
        <nav
          aria-label={isEdition ? "Menu de l'édition" : "Menu de la boutique"}
          className="container-page flex flex-wrap items-center gap-x-6 gap-y-1 py-2 text-sm font-semibold"
        >
          {subNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-1 py-0.5 hover:underline ${
                pathname === item.href ? "underline" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="container-page space-y-5 py-4">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/edition" className={`${tabClass(isEdition, "brand")} text-center`}>
                Édition
              </Link>
              <Link href="/boutique" className={`${tabClass(!isEdition, "teal")} text-center`}>
                Boutique
              </Link>
            </div>

            <Link href="/edition/deposer" className="btn-accent w-full">
              Déposer un manuscrit
            </Link>

            <div className={`rounded-2xl border p-3 ${subBarClass}`}>
              <p className="eyebrow mb-2 opacity-80">{isEdition ? "Édition" : "Boutique"}</p>
              <ul className="space-y-1 text-sm font-semibold">
                {subNav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="block py-1">
                      {item.label}
                    </Link>
                  </li>
                ))}
                {!isEdition && (
                  <li>
                    <Link href="/panier" className="block py-1">
                      {cartLabel}
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-2 text-slate-500">Mon compte</p>
              {user ? (
                <ul className="space-y-1 text-sm">
                  {accountLinks(user).map((item) => (
                    <li key={item.href}>
                      <ItemLink item={item} className="block py-1 text-slate-700" />
                    </li>
                  ))}
                  <li className="pt-2">
                    <SignOutButton />
                  </li>
                </ul>
              ) : (
                <ul className="space-y-1 text-sm text-slate-700">
                  <li>
                    <Link href="/edition/connexion" className="block py-1">
                      Connexion auteur
                    </Link>
                  </li>
                  <li>
                    <Link href="/edition/inscription" className="block py-1">
                      Créer un compte auteur
                    </Link>
                  </li>
                  <li>
                    <Link href="/boutique/acheteur/connexion" className="block py-1">
                      Connexion acheteur
                    </Link>
                  </li>
                  <li>
                    <Link href="/boutique/acheteur/inscription" className="block py-1">
                      Créer un compte acheteur
                    </Link>
                  </li>
                  <li>
                    <Link href="/boutique/vendeur/connexion" className="block py-1">
                      Connexion vendeur
                    </Link>
                  </li>
                  <li>
                    <Link href="/boutique/vendeur/inscription" className="block py-1">
                      Créer un compte vendeur
                    </Link>
                  </li>
                </ul>
              )}
            </div>

            <Link href="/a-propos" className="block text-sm font-semibold text-slate-700">
              À propos
            </Link>
          </div>
        </div>
      )}

      {user && !user.verified && (
        <div className="border-t border-amber-200 bg-amber-50">
          <div className="container-page py-2 text-sm text-amber-900">
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
