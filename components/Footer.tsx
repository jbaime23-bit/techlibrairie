import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: '#0f172a', color: '#94a3b8', padding: '40px 20px', marginTop: '60px', borderTop: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* Ligne principale */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <h3 style={{ color: '#fff', marginBottom: '10px' }}>TechLibrairie</h3>
            <p style={{ maxWidth: 300, fontSize: '14px' }}>La librairie en ligne dédiée aux savoirs techniques et à l'innovation technologique au Burkina Faso.</p>
          </div>
          
          {/* Section Contact */}
          <div>
            <h4 style={{ color: '#fff', marginBottom: '10px' }}>Contact & Support</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>📧 Email : <a href="mailto:jb.aime23@gmail.com" style={{ color: '#0087db', textDecoration: 'none' }}>jb.aime23@gmail.com</a></li>
              <li>💬 WhatsApp : <a href="https://wa.me" style={{ color: '#0087db', textDecoration: 'none' }}>+226 76 16 69 74</a></li>
            </ul>
          </div>
        </div>

        {/* Ligne du Bas - Copyright */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', fontSize: '12px' }}>
          <p>&copy; {currentYear} TechLibrairie. Tous droits réservés.</p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <Link href="/conditions" style={{ color: '#94a3b8', textDecoration: 'none' }}>Conditions d'utilisation</Link>
            <Link href="/confidentialite" style={{ color: '#94a3b8', textDecoration: 'none' }}>Politique de confidentialité</Link>
          </div>
        </div>

      </div>
    </footer>
  );
              }
