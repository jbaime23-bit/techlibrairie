// src/components/layout/header.tsx
// En-tête du site : lit l'utilisateur et le panier côté serveur, puis confie l'affichage au composant
// SiteHeader (menu adapté à la section Édition ou Boutique).
import { getCurrentUser } from "@/lib/auth";
import { getCartIds } from "@/lib/cart";
import { SiteHeader } from "@/components/layout/site-header";

export async function Header() {
  const user = await getCurrentUser();
  const cartCount = (await getCartIds()).length;

  return (
    <SiteHeader
      user={
        user
          ? {
              name: user.name ?? null,
              role: user.role,
              verified: Boolean(user.emailVerified),
            }
          : null
      }
      cartCount={cartCount}
    />
  );
}
