"use client";

import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="checkout-panel" style={{ maxWidth: 520, margin: '80px auto', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <p className="kicker" style={{ color: '#0087db', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px', marginBottom: '5px' }}>Connexion</p>
        <h1 style={{ fontSize: '28px', marginBottom: '25px', fontWeight: 'bold' }}>Accéder à votre espace</h1>
        
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const target = event.currentTarget as HTMLFormElement;
            const formData = new FormData(target);
            const email = String(formData.get('email') ?? '');
            const password = String(formData.get('password') ?? '');
            signIn('credentials', { email, password, redirect: true, callbackUrl: '/dashboard' });
          }}
          className="login-form"
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '600', fontSize: '14px' }}>Email</label>
            <input 
              name="email" 
              type="email" 
              placeholder="vous@example.com" 
              required 
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: '600', fontSize: '14px' }}>Mot de passe</label>
              <Link href="/forgot-password" style={{ color: '#0087db', fontSize: '13px', textDecoration: 'none' }}>
                Mot de passe oublié ?
              </Link>
            </div>
            <input 
              name="password" 
              type="password" 
              placeholder="••••••••" 
              required 
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
            />
          </div>

          <button 
            type="submit" 
            className="primary-btn full-width"
            style={{ backgroundColor: '#0087db', color: '#fff', padding: '14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px' }}
          >
            Se connecter
          </button>
        </form>

        {/* Liens d'inscription fonctionnels pour TechLibrairie */}
        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          <p style={{ marginBottom: '10px' }}>
            Vous n'avez pas encore de compte ?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <Link href="/register" style={{ color: '#0087db', fontWeight: 'bold', textDecoration: 'none' }}>
              S'inscrire comme Auteur / Vendeur
            </Link>
          </div>
        </div>

      </section>
    </main>
  );
}
