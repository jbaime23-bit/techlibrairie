// src/components/layout/footer.tsx
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-page py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} TechLibrairie. Livres et guides techniques
        au format PDF.
      </div>
    </footer>
  );
}
