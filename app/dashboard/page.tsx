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
  
  // États pour le formulaire d'ajout de livre
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(''); // Nouvel état pour l'image de couverture
  const [status, setStatus] = useState({ loading: false, message: '', success: false });

  useEffect(() => {
    const localData = localStorage.getItem('techlibrairie_books');
    if (localData) {
      const listeLivres: Livre[] = JSON.parse(localData);
      setNombreLivres(listeLivres.length);
      setTotalVentes(listeLivres.length * 2); 
    }
  }, []);

  const scrollToForm = () => {
    const formElement = document.getElementById('formulaire-ajout-livre');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true, message: '', success: false });

    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          author,
          price: parseFloat(price),
          description,
          coverImage // Envoi de l'image à la base de données Neon
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible d'enregistrer le livre.");
      }

      setStatus({ loading: false, message: "Félicitations ! Votre livre technique avec sa couverture a été enregistré avec succès.", success: true });
      
      setTitle('');
      setAuthor('');
      setPrice('');
      setDescription('');
      setCoverImage('');
      setNombreLivres(prev => prev + 1);

    } catch (error: any) {
      setStatus({ loading: false, message: error.message, success: false });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="mb-8 border-b border-slate-700 pb-4">
        <p className="text-xs text-blue-400 uppercase font-bold tracking-wider">Espace Administration</p>
        <h1 className="text-2xl font-bold text-white mt-1">📊 Tableau de Bord (Dashboard)</h1>
        <p className="text-sm text-slate-400 mt-1">Espace d'administration des Auteurs et Éditeurs</p>
      </header>

      {/* Blocs de défilement */}
      <div className="flex flex-col gap-4 mb-8">
        <div onClick={scrollToForm} className="bg-white text-slate-900 p-5 rounded-xl cursor-pointer hover:bg-slate-100 transition duration-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-950">Auteur</h3>
          <p className="text-xs text-slate-600 mt-1">Gérez vos livres, suivez vos ventes et recevez vos gains.</p>
        </div>
        <div onClick={scrollToForm} className="bg-white text-slate-900 p-5 rounded-xl cursor-pointer hover:bg-slate-100 transition duration-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-950">Éditeur</h3>
          <p className="text-xs text-slate-600 mt-1">Publiez, validez et supervisez les ouvrages numériques.</p>
        </div>
        <div onClick={scrollToForm} className="bg-white text-slate-900 p-5 rounded-xl cursor-pointer hover:bg-slate-100 transition duration-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-950">Vendeur</h3>
          <p className="text-xs text-slate-600 mt-1">Ajoutez des catalogues de livres techniques et gérez vos stocks.</p>
        </div>
      </div>

      {/* Cartes de statistiques */}
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

      {/* Formulaire mis à jour avec la couverture */}
      <div id="formulaire-ajout-livre" className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-6">
        <h2 className="text-lg font-bold mb-4 text-blue-400">📚 Mettre un nouveau livre PDF en vente</h2>
        
        {status.message && (
          <div className={`p-3 rounded mb-4 text-sm font-medium ${status.success ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleAddBook} className="flex flex-col gap-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-300 font-semibold">Titre du livre numérique</label>
              <input 
                type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Électricien des installations domestiques"
                className="p-3 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-300 font-semibold">Nom de l'auteur ou éditeur</label>
              <input 
                type="text" required value={author} onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ex: Jean-Baptiste Aimé"
                className="p-3 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-300 font-semibold">Prix de vente (en FCFA)</label>
              <input 
                type="number" required value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex: 8500"
                className="p-3 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-300 font-semibold">Manuscrit principal (Fichier PDF)</label>
              <input 
                type="file" accept=".pdf" required
                className="p-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
            </div>
          </div>

          {/* AJOUT DE LA CASE PHOTO DE COUVERTURE */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300 font-semibold">Image de couverture de l'ouvrage (Photo / Image)</label>
            <input 
              type="file" accept="image/*" required
              className="p-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300 font-semibold">Description ou résumé du livre</label>
            <textarea 
              rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez les compétences ou travaux pratiques abordés..."
              className="p-3 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button 
            type="submit" disabled={status.loading}
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded text-sm transition duration-200 disabled:opacity-50"
          >
            {status.loading ? 'Enregistrement dans Neon...' : '🚀 Publier le livre et activer la vente'}
          </button>
        </form>
      </div>

      {/* Sécurité */}
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-6">
        <h2 className="text-lg font-bold mb-3 text-slate-200">🛡️ Sécurité des manuscrits</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Chaque fichier PDF téléversé par un éditeur est automatiquement protégé. Le système limite l'accès à un maximum de 2 téléchargements par achat pour éviter le partage non autorisé.
        </p>
      </div>

      {/* Gains */}
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h2 className="text-lg font-bold mb-3 text-slate-200">🏦 Reversements & Gains</h2>
        <p className="text-sm text-slate-400 mb-4">
          Le suivi des commissions et les retraits seront disponibles ici dès l'activation de vos modules de paiement.
        </p>
        <div className="bg-slate-900 p-3 rounded text-xs text-yellow-500 border border-yellow-600/30">
          ⏳ En attente de l'intégration de votre code IBAN et des fonctionnalités MasterCard.
        </div>
      </div>
            
