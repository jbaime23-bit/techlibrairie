"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, message: '', success: false });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ loading: true, message: '', success: false });

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Une erreur est survenue.');
      }

      setStatus({ loading: false, message: data.message, success: true });
      setFormData({ name: '', email: '', password: '' });
    } catch (error: any) {
      setStatus({ loading: false, message: error.message, success: false });
    }
  };

  return (
    <main className="page-shell">
      <section className="checkout-panel" style={{ maxWidth: 520, margin: '80px auto', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <p className="kicker" style={{ color: '#0087db', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px', marginBottom: '5px' }}>Inscription</p>
        <h1 style={{ fontSize: '28px', marginBottom: '25px', fontWeight: 'bold' }}>Créer votre compte Auteur / Vendeur</h1>

        {status.message && (
          <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', backgroundColor: status.success ? '#dcfce7' : '#fee2e2', color: status.success ? '#15803d' : '#b91c1c', fontSize: '14px', fontWeight: '500' }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px' }}>Nom complet ou Nom d'auteur</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Jean-Baptiste Aimé"
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px' }}>Email professionnel</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="vous@example.com"
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px' }}>Mot de passe (6 caractères minimum)</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
            />
          </div>

          <button
            type="submit"
            disabled={status.loading}
            style={{ backgroundColor: '#0087db', color: '#fff', padding: '14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: status.loading ? 'not-allowed' : 'pointer', marginTop: '10px', opacity: status.loading ? 0.7 : 1 }}
          >
            {status.loading ? 'Création en cours...' : "S'inscrire"}
          </button>
        </form>

        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          <p style={{ marginBottom: '10px' }}>Vous avez déjà un compte ?</p>
          <Link href="/login" style={{ color: '#0087db', fontWeight: 'bold', textDecoration: 'none' }}>
            Se connecter à l'espace
          </Link>
        </div>
      </section>
    </main>
  );
  }
                       
