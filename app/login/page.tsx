import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="checkout-panel" style={{ maxWidth: 520, margin: '80px auto' }}>
        <p className="kicker">Connexion</p>
        <h1>Accéder à votre espace</h1>
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
        >
          <label>
            Email
            <input name="email" type="email" placeholder="vous@example.com" required />
          </label>
          <label>
            Mot de passe
            <input name="password" type="password" placeholder="••••••••" required />
          </label>
          <button type="submit" className="primary-btn full-width">Se connecter</button>
        </form>
      </section>
    </main>
  );
}
