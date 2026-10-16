"use client";

export function ProductForm({ sellerId, categories, commissionPercent }: any) {
  return (
    <form className="space-y-4 p-4 border rounded bg-white">
      <h2 className="text-xl font-bold">Ajouter un ouvrage</h2>
      <div>
        <label className="block text-sm font-medium">Titre de l'ouvrage</label>
        <input type="text" className="w-full border p-2 rounded" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Prix (FCFA)</label>
        <input type="number" className="w-full border p-2 rounded" required />
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold">
        🚀 Mettre l'ouvrage en vente
      </button>
    </form>
  );
}
