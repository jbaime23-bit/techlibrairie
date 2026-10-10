"use client";

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, message: '', success: false });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ loading: true, message: '', success: false });

    try {
      // Appel direct au fournisseur de connexion NextAuth (Credentials)
      const result = await signIn('credentials', {
        redirect: false,
        email: formData.email,
        password: formData.password,
      });

      if (result?.error) {
        throw new Error("Identifiants incorrects. Veuillez revérifier votre email et mot de passe.");
      }

      setStatus({ loading: false, message: "Connexion réussie ! Redirection vers votre espace...", success: true });
      
      // Redirection automatique et propre vers le tableau de bord d'administration
      router.push('/dashboard');
      router.refresh();
      
    } catch (error: any) {
      setStatus({ loading: false, message: error.message, success: false });
    }
  };

  return (
    <main className="page-shell">
      <section className="checkout-panel" style={{ maxWidth: 480, margin: '80px auto', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <p className="kicker" style={{ color: '#0087db', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px', marginBottom: '5px' }}>Espace Connexion</p>
        <h1 style={{ fontSize: '28px', marginBottom: '25px', fontWeight: 'bold' }}>Accéder à TechLibrairie</h1>

        {status.message && (
          <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', backgroundColor: status.success ? '#dcfce7' : '#fee2e2', color: status.success ? '#15803d' : '#b91c1c', fontSize: '14px', fontWeight: '500' }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px' }}>Votre adresse email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Ex: vous@example.com"
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px' }}>Votre mot de passe</label>
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
            {status.loading ? 'Vérification en cours...' : 'Se connecter'}
          </button>
        </form>

        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          <p style={{ marginBottom: '10px' }}>Vous n'avez pas encore de compte d'auteur ?</p>
          <Link href="/register" style={{ color: '#0087db', fontWeight: 'bold', textDecoration: 'none' }}>
            Créer un compte Vendeur / Éditeur
          </Link>
        </div>
      </section>
    </main>
  );
      }
