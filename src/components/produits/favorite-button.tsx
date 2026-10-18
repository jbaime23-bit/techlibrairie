// src/components/produits/favorite-button.tsx
// Bouton « favoris » : un simple formulaire (aucun script nécessaire).
import { toggleFavoriteAction } from "@/app/favoris/actions";

export function FavoriteButton({
  productId,
  isFavorite,
  from,
  fullWidth = false,
}: {
  productId: string;
  isFavorite: boolean;
  from: "produit" | "liste";
  fullWidth?: boolean;
}) {
  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="from" value={from} />
      <button
        type="submit"
        aria-pressed={isFavorite}
        className={`btn-secondary ${fullWidth ? "w-full" : ""}`}
      >
        {isFavorite ? "♥ Retirer des favoris" : "♡ Ajouter aux favoris"}
      </button>
    </form>
  );
}
