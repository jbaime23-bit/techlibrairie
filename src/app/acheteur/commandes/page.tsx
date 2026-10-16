"use client";

import React, { useState } from "react";

export default function ProductForm() {
  const [loading, setLoading] = useState(false);

  return (
    <form className="space-y-6">
      <h2 className="text-xl font-bold">Ajouter un produit</h2>
      
      {/* C'est ici que le code coupait dans vos logs Vercel */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm font-medium">Nom du produit</label>
          <input type="text" id="title" className="border rounded px-3 py-2" required />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium">Prix (€)</label>
          <input type="number" id="price" className="border rounded px-3 py-2" required />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea id="description" className="border rounded px-3 py-2" rows={4} />
      </div>

      <button type="submit" disabled={loading} className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50">
        {loading ? "Enregistrement..." : "Enregistrer le produit"}
      </button>
    </form>
  );
}
