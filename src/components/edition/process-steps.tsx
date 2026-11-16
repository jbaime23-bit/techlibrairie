// src/components/edition/process-steps.tsx
// Les quatre grandes étapes d'une édition, de l'accueil à la publication.

const STEPS = [
  {
    title: "Vous déposez votre projet",
    text: "Titre, résumé, manuscrit et couverture : quatre étapes simples, une à la fois.",
  },
  {
    title: "Nous l'examinons",
    text: "Contrôle de conformité pour la formule à compte d'auteur, examen éditorial pour la formule à compte d'éditeur.",
  },
  {
    title: "Nous le mettons en page",
    text: "Maquette professionnelle, puis bon à tirer : rien n'est publié sans votre accord.",
  },
  {
    title: "Votre livre est publié",
    text: "En PDF et en livre imprimé à la demande, dans la boutique TechLibrairie.",
  },
];

export function ProcessSteps() {
  return (
    <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((step, index) => (
        <li key={step.title} className="card card-hover">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-lg font-extrabold text-white shadow-soft">
            {index + 1}
          </span>
          <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
