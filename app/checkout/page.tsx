"use client";

import React, { useState } from 'react';

export default function CheckoutPage() {
  const [methodePaiement, setMethodePaiement] = useState('');
  const [estPaye, setEstPaye] = useState(false);

  const gererPaiement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!methodePaiement) {
      alert("Veuillez sélectionner un mode de paiement.");
      return;
    }
    
    // Simulation du succès du paiement
    setEstPaye(true);
    alert("Simulation réussie ! Dès que votre IBAN et MasterCard seront connectés, cette action validera le vrai transfert bancaire.");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 text-gray-900 flex flex-col items-center">
      <div className="bg-white p-6 rounded-lg shadow-md border w-full max-w-md">
        <header className="mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-blue-900">🔒 Finaliser ma commande</h1>
          <p className="text-xs text-gray-500 mt-1">Paiement sécurisé TechLibrairie</p>
        </header>

        {!estPaye ? (
          <form onSubmit={gererPaiement}>
            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                Sélectionnez votre mode de règlement :
              </h2>
              
              <div className="space-y-3">
                {/* Option MasterCard (Prévue pour plus tard) */}
                <label className="flex items-center p-3 border rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                  <input 
                    type="radio" 
                    name="payment" 
                    value="mastercard" 
                    onChange={(e) => setMethodePaiement(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500" 
                  />
                  <div className="ml-3">
                    <span className="block font-bold text-sm text-gray-800">💳 Carte MasterCard / Visa</span>
                    <span className="block text-xs text-gray-500">Paiement international par carte bancaire (Bientôt disponible)</span>
                  </div>
                </label>

                {/* Options Locales (Orange Money / Moov Money) */}
                <label className="flex items-center p-3 border rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                  <input 
                    type="radio" 
                    name="payment" 
                    value="mobile_money" 
                    onChange={(e) => setMethodePaiement(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500" 
                  />
                  <div className="ml-3">
                    <span className="block font-bold text-sm text-gray-800">📱 Mobile Money</span>
                    <span className="block text-xs text-gray-500">Faites vos achats via Orange Money ou Moov Money</span>
                  </div>
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition shadow"
            >
              Confirmer et payer
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-green-600 mb-2">Paiement Validé !</h2>
            <p className="text-sm text-gray-600 mb-6">
              Merci pour votre achat. Votre fichier PDF est prêt à être téléchargé de manière sécurisée.
            </p>
            <button 
              onClick={() => alert("Le téléchargement du PDF sécurisé démarrera ici.")}
              className="bg-green-600 text-white px-6 py-2 rounded-md font-bold hover:bg-green-700 transition"
            >
              📥 Télécharger mon livre PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
