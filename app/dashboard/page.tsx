"use client";

import React, { useState, useEffect } from 'react';

interface Livre {
  id: string;
  title: string;
  price: number;
  author: string;
}

export default function DashboardAdmin() {
  const [totalVentes, setTotalVentes] = useState(0);
  const [nombreLivres, setNombreLivres] = useState(0);

  useEffect(() => {
    // Récupérer automatiquement les livres que vous ou d'autres auteurs avez ajoutés
    const localData = localStorage.getItem('techlibrairie_books');
    if (localData) {
      const listeLivres: Livre[] = JSON.parse(localData);
      setNombreLivres(listeLivres.length);
      
      // Simulation de statistiques de ventes (pour le test avant intégration IBAN/MasterCard)
      setTotalVentes(listeLivres.length * 2); 
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="mb-8 border-b border-slate-700 pb-4">
        <h1 className="text-2xl font-bold text-blue-400">📊 Tableau de Bord (Dashboard)</h1>
        <p className="text-sm text-slate-400 mt-1">Espace d'administration des Auteurs et Éditeurs</p>
      </header>

      {/* Cartes de statistiques de la boutique */}
      <div className="grid gap-4 grid-cols-2 mb-8">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 uppercase font-semibold">Livres en ligne</p>
          <p className="text-3xl font-extrabold text-blue-500 mt-1">{nombreLivres}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 uppercase font-semibold">Téléchargements</p>
          <p className="text-3xl font-extrabold text-green-500 mt-1">{totalVentes}</p>
        </div>
      </div>

      {/* Section de gestion des fichiers PDF */}
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-6">
        <h2 className="text-lg font-bold mb-3 text-slate-200">🛡️ Sécurité des manuscrits</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Chaque fichier PDF téléversé par un éditeur est automatiquement protégé. Le système limite l'accès à un maximum de 2 téléchargements par achat pour éviter le partage non autorisé.
        </p>
      </div>

      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h2 className="text-lg font-bold mb-3 text-slate-200">🏦 Reversements & Gains</h2>
        <p className="text-sm text-slate-400 mb-4">
          Le suivi des commissions et les retraits seront disponibles ici dès l'activation de vos modules de paiement.
        </p>
        <div className="bg-slate-900 p-3 rounded text-xs text-yellow-500 border border-yellow-600/30">
          ⏳ En attente de l'intégration de votre code IBAN et des fonctionnalités MasterCard.
        </div>
      </div>
    </div>
  );
}
