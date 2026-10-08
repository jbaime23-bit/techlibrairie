"use client";

import React, { useState, useEffect } from 'react';

interface Livre {
  id: string;
  title: string;
  description: string;
  price: number;
  author: string;
}

export default function CatalogueDynamique() {
  const [livres, setLivres] = useState<Livre[]>([]);
  const [titre, setTitre] = useState('');
  const [auteur, setAuteur] = useState('');
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  // Charger les livres ajoutés depuis la mémoire du téléphone
  useEffect(() => {
    const localData = localStorage.getItem('techlibrairie_books');
    if (localData) {
      setLivres(JSON.parse(localData));
    }
  }, []);

  // Fonction pour ajouter votre livre ou laisser un autre auteur le faire
  const gererAjoutLivre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre || !auteur || !prix) {
      alert("Veuillez remplir au moins le titre, l'auteur et le prix.");
      return;
    }

    const nouveauLivre: Livre = {
      id: Date.now().toString(),
      title: titre,
      author: auteur,
      description: description,
      price: parseFloat(prix)
    };

    const NouvelleListe = [...livres, nouveauLivre];
    setLivres(NouvelleListe);
    localStorage.setItem('techlibrairie_books', JSON.stringify(NouvelleListe));

    // Réinitialiser le formulaire
    setTitre('');
    setAuteur('');
    setDescription('');
    setPrix('');
    setAfficherFormulaire(false);
    alert("Votre livre a bien été ajouté au catalogue de la boutique !");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <h1 className="text-3xl font-bold text-blue-900">Boutique TechLibrairie</h1>
        <button 
          onClick={() => setAfficherFormulaire(!afficherFormulaire)}
          className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 transition"
        >
          {afficherFormulaire ? "✖ Fermer" : "➕ Ajouter un livre (Auteur/Éditeur)"}
        </button>
      </header>

      {/* Formulaire dynamique d'ajout */}
      {afficherFormulaire && (
        <form onSubmit={gererAjoutLivre} className="bg-white p-6 rounded-lg shadow-md border mb-8 max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Mettre un livre en vente</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Titre du livre *</label>
            <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full border p-2 rounded" placeholder="Ex: Électricien des installations..." />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Auteur *</label>
            <input type="text" value={auteur} onChange={(e) => setAuteur(e.target.value)} className="w-full border p-2 rounded" placeholder="Nom de l'auteur" />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Prix (FCFA) *</label>
            <input type="number" value={prix} onChange={(e) => setPrix(e.target.value)} className="w-full border p-2 rounded" placeholder="Ex: 5000" />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description / Résumé</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border p-2 rounded" rows={3} placeholder="Présentation du livre..."></textarea>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700">
            Publier sur la boutique
          </button>
        </form>
      )}

      {/* Affichage des livres de la boutique */}
      {livres.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border shadow-sm">
          <p className="text-lg font-medium">La boutique est actuellement vide.</p>
          <p className="text-sm mt-1">Cliquez sur le bouton en haut pour ajouter votre premier livre !</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {livres.map((livre) => (
            <div key={livre.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{livre.title}</h2>
                <p className="text-sm text-gray-500 mb-4">Par {livre.author}</p>
                {livre.description && <p className="text-gray-600 mb-4">{livre.description}</p>}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-xl font-extrabold text-blue-600">{livre.price} FCFA</span>
                <button 
                  onClick={() => alert("Lien de paiement sécurisé en attente de vos configurations IBAN et MasterCard.")}
                  className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition"
                >
                  Acheter le PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
                }
