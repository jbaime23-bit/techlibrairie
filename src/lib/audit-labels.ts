// src/lib/audit-labels.ts
// Libellés français des actions du journal et catégories de filtre.

export const ACTION_LABELS: Record<string, string> = {
  "admin.connexion": "Connexion",
  "admin.connexion_code_refuse": "Connexion : code de vérification refusé",
  "admin.code_de_secours_utilise": "Code de secours utilisé",
  "admin.2fa_activee": "Double authentification activée",
  "admin.2fa_desactivee": "Double authentification désactivée",
  "admin.2fa_codes_regeneres": "Codes de secours régénérés",
  "admin.2fa_reinitialisee_par_variable": "Double authentification effacée (variable de secours)",
  "admin.promu": "Administrateur nommé",
  "admin.retrograde": "Administrateur retiré",
  "commande.remboursee": "Commande remboursée",
  "versement.pris_en_charge": "Versement pris en charge",
  "versement.paye": "Versement marqué comme payé",
  "versement.refuse": "Versement refusé",
  "vendeur.statut_modifie": "Statut d'un vendeur modifié",
  "vendeur.commission_modifiee": "Commission d'un vendeur modifiée",
  "produit.statut_modifie": "Statut d'un produit modifié",
  "utilisateur.statut_modifie": "Compte utilisateur activé ou désactivé",
  "utilisateur.efface": "Compte utilisateur effacé (anonymisé)",
  "publicite.creee": "Publicité créée",
  "publicite.basculee": "Publicité activée ou désactivée",
  "publicite.supprimee": "Publicité supprimée",
  "taux.modifie": "Taux de change modifié",
  "parametres.modifies": "Paramètres modifiés",
  "maintenance.analyse": "Maintenance : analyse à blanc",
  "maintenance.nettoyage": "Maintenance : nettoyage réel",
  "contact.statut_modifie": "Statut d'un message de contact modifié",
};

export function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code;
}

export const AUDIT_CATEGORIES: { value: string; label: string; prefixes: string[] }[] = [
  { value: "securite", label: "Connexions et sécurité", prefixes: ["admin."] },
  { value: "commandes", label: "Commandes", prefixes: ["commande."] },
  { value: "versements", label: "Versements", prefixes: ["versement."] },
  { value: "catalogue", label: "Vendeurs et produits", prefixes: ["vendeur.", "produit."] },
  { value: "utilisateurs", label: "Utilisateurs", prefixes: ["utilisateur."] },
  { value: "publicites", label: "Publicités", prefixes: ["publicite."] },
  {
    value: "configuration",
    label: "Configuration",
    prefixes: ["parametres.", "taux.", "maintenance.", "contact."],
  },
];
