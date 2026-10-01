# 📚 TECHLIBRAIRIE - Plan Projet Détaillé

## 🎯 Vision Globale
Plateforme de vente automatisée de livres PDF avec écosystème complet pour auteurs, éditeurs et vendeurs, avec système de paiement multi-canaux (Orange Money, Moov Money, Virement bancaire).

---

## 📋 PHASE 1 : Architecture & Infrastructure (Semaine 1)

### 1.1 Stack Technologique Recommandée
```
Frontend: Next.js 14+ (React, TypeScript, Tailwind CSS)
Backend: Next.js API Routes + Node.js
Base de données: PostgreSQL (production) / SQLite (développement)
ORM: Prisma
Authentification: NextAuth.js
Paiement: Intégration custom (Orange Money, Moov Money, Virement)
Stockage PDF: AWS S3 ou Supabase Storage
Email: SendGrid / Brevo
Versioning: Git + GitHub
```

### 1.2 Structure du Projet
```
techlibrairie/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (shop)/
│   │   │   ├── catalogue/
│   │   │   ├── book/[id]/
│   │   │   ├── cart/
│   │   │   └── checkout/
│   │   ├── (dashboard)/
│   │   │   ├── author/
│   │   │   ├── editor/
│   │   │   ├── vendor/
│   │   │   └── admin/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── books/
│   │   │   ├── payment/
│   │   │   ├── downloads/
│   │   │   └── orders/
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/
│   ├── prisma/
│   └── types/
├── public/
├── .env.local
├── prisma/
│   └── schema.prisma
└── package.json
```

---

## 📊 PHASE 2 : Base de Données (Semaine 1-2)

### 2.1 Schema Prisma Complet

```prisma
// Utilisateurs et Authentification
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  password        String
  firstName       String
  lastName        String
  avatar          String?
  phoneNumber     String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations
  roles           Role[]
  authorProfile   Author?
  editorProfile   Editor?
  vendorProfile   Vendor?
  orders          Order[]
  downloads       Download[]
  paymentMethods  PaymentMethod[]
}

// Rôles Utilisateur
model Role {
  id        String   @id @default(cuid())
  name      String   @unique // ADMIN, AUTHOR, EDITOR, VENDOR, CUSTOMER
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, name])
}

// Profil Auteur
model Author {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio             String?
  profileImage    String?
  socialLinks     String? // JSON
  bankAccount     String?
  commissionRate  Float     @default(0.50) // 50% commission
  isVerified      Boolean   @default(false)
  books           Book[]
  sales           AuthorSale[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Profil Éditeur
model Editor {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  companyName     String
  companyLogo     String?
  description     String?
  bankAccount     String?
  commissionRate  Float     @default(0.30) // 30% commission
  isVerified      Boolean   @default(false)
  books           Book[] @relation("EditorBooks")
  publishedBooks  Book[] @relation("EditorPublished")
  sales           EditorSale[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Profil Vendeur
model Vendor {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  shopName        String
  shopDescription String?
  shopImage       String?
  bankAccount     String?
  commissionRate  Float     @default(0.15) // 15% commission
  isVerified      Boolean   @default(false)
  inventory       VendorInventory[]
  sales           VendorSale[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Livres
model Book {
  id              String    @id @default(cuid())
  title           String
  description     String
  coverImage      String
  pdfFile         String // URL S3
  fileSize        Int       // en bytes
  price           Float
  currency        String    @default("XOF") // CFA
  
  // Auteur/Éditeur
  authorId        String?
  author          Author?   @relation(fields: [authorId], references: [id])
  editorId        String?
  editor          Editor?   @relation("EditorBooks", fields: [editorId], references: [id])
  publisherId     String?
  publisher       Editor?   @relation("EditorPublished", fields: [publisherId], references: [id])
  
  // Métadonnées
  category        String
  tags            String[] // Array
  isbn            String?
  language        String    @default("fr")
  pageCount       Int?
  publishedDate   DateTime?
  
  // Stats
  totalDownloads  Int       @default(0)
  rating          Float     @default(0)
  reviews         Review[]
  
  // Inventaire Vendeur
  vendorInventory VendorInventory[]
  orderItems      OrderItem[]
  
  isPublished     Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([authorId])
  @@index([editorId])
  @@index([publisherId])
}

// Inventaire Vendeur
model VendorInventory {
  id              String    @id @default(cuid())
  vendorId        String
  vendor          Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  bookId          String
  book            Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)
  quantity        Int       @default(1) // Pour livres illimités: -1
  commission      Float     // Commission spécifique au vendeur pour ce livre
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([vendorId, bookId])
}

// Commandes
model Order {
  id              String    @id @default(cuid())
  orderNumber     String    @unique // TECH-2026-XXXXX
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  items           OrderItem[]
  totalAmount     Float
  currency        String    @default("XOF")
  
  status          String    @default("PENDING") // PENDING, PAID, DELIVERED, FAILED
  paymentMethod   String?   // ORANGE_MONEY, MOOV_MONEY, BANK_TRANSFER
  paymentReference String?
  
  deliveredAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([userId])
  @@index([status])
}

// Items Commande
model OrderItem {
  id              String    @id @default(cuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  bookId          String
  book            Book      @relation(fields: [bookId], references: [id])
  quantity        Int       @default(1)
  priceAtPurchase Float
  
  @@unique([orderId, bookId])
}

// Téléchargements & Limite
model Download {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  orderId         String
  
  bookTitle       String
  pdfUrl          String
  
  downloadCount   Int       @default(0) // Max 2
  lastDownloadAt  DateTime?
  expiresAt       DateTime  // 30 jours après achat
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([userId, orderId])
  @@index([userId])
  @@index([expiresAt])
}

// Méthodes de Paiement
model PaymentMethod {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  type            String    // ORANGE_MONEY, MOOV_MONEY, BANK_ACCOUNT
  
  // Orange Money / Moov Money
  phoneNumber     String?
  operatorRef     String?
  
  // Virement Bancaire
  accountHolder   String?
  accountNumber   String?
  bankCode        String?
  iban            String?
  
  isDefault       Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Transactions Paiement
model Payment {
  id              String    @id @default(cuid())
  paymentId       String    @unique // ID unique de paiement
  orderId         String
  
  amount          Float
  currency        String    @default("XOF")
  method          String    // ORANGE_MONEY, MOOV_MONEY, BANK_TRANSFER
  status          String    @default("PENDING") // PENDING, COMPLETED, FAILED, REFUNDED
  
  // Données Paiement
  phoneNumber     String?   // Pour Orange/Moov
  transactionRef  String?   // Référence opérateur
  bankDetails     String?   // JSON pour virement
  
  errorMessage    String?
  attemptCount    Int       @default(0)
  lastAttemptAt   DateTime?
  
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([orderId])
  @@index([status])
}

// Ventes Auteur (Statistiques)
model AuthorSale {
  id              String    @id @default(cuid())
  authorId        String
  author          Author    @relation(fields: [authorId], references: [id], onDelete: Cascade)
  
  monthYear       String    // "2026-10"
  totalSales      Float
  totalDownloads  Int
  commission      Float
  
  @@unique([authorId, monthYear])
}

// Ventes Éditeur (Statistiques)
model EditorSale {
  id              String    @id @default(cuid())
  editorId        String
  editor          Editor    @relation(fields: [editorId], references: [id], onDelete: Cascade)
  
  monthYear       String    // "2026-10"
  totalSales      Float
  totalDownloads  Int
  commission      Float
  
  @@unique([editorId, monthYear])
}

// Ventes Vendeur (Statistiques)
model VendorSale {
  id              String    @id @default(cuid())
  vendorId        String
  vendor          Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  
  monthYear       String    // "2026-10"
  totalSales      Float
  totalDownloads  Int
  commission      Float
  
  @@unique([vendorId, monthYear])
}

// Avis & Commentaires
model Review {
  id              String    @id @default(cuid())
  bookId          String
  book            Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)
  
  rating          Int       // 1-5
  comment         String?
  authorName      String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([bookId])
}

// Logs d'Accès
model AccessLog {
  id              String    @id @default(cuid())
  userId          String
  orderId         String
  
  action          String    // DOWNLOAD_INITIATED, DOWNLOAD_COMPLETED, DOWNLOAD_FAILED
  ipAddress       String?
  userAgent       String?
  
  createdAt       DateTime  @default(now())
}
```

---

## 💳 PHASE 3 : Système de Paiement Avancé (Semaine 2)

### 3.1 Configuration Paiements

#### Orange Money
```
Numéro: 76166974
Réseau: Orange (Mali, Senegal, etc.)
Flux: 
1. Utilisateur entre son numéro Orange
2. Vérification du solde
3. PIN OTP envoyé
4. Débit automatique
5. Confirmation immédiate
```

#### Moov Money
```
Numéro: 70011017
Réseau: Moov (Côte d'Ivoire, Mali, etc.)
Flux: Idem Orange Money
```

#### Virement Bancaire
```
Pour: Utilisateurs étrangers
Détails bancaires à fournir par l'administrateur
Vérification manuelle ou semi-automatique
Délai: 1-3 jours
```

### 3.2 Architecture Paiement

```
┌─────────────────────────────────────────────────────┐
│           FRONTEND (Panier → Paiement)             │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────┐
        │   Sélection Méthode Paiement │
        └────────┬────────────────────┘
                 │
    ┌────────────┼────────────────┐
    │            │                │
    ▼            ▼                ▼
┌─────────┐ ┌─────────┐  ┌──────────────┐
│ Orange  │ │  Moov   │  │   Virement   │
│ Money   │ │ Money   │  │  Bancaire    │
└────┬────┘ └────┬────┘  └──────┬───────┘
     │           │              │
     └───────────┼──────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │  Payment Service API │
      │  (Backend)           │
      └──────┬───────────────┘
             │
    ┌────────┼────────────┐
    │        │            │
    ▼        ▼            ▼
┌─────────────────┐  ┌──────────────────┐
│ Webhook Orange/ │  │ Database Update  │
│ Moov (Async)    │  │ Order Status     │
└────────┬────────┘  └────────┬─────────┘
         │                    │
         └────────┬───────────┘
                  ▼
        ┌─────────────────────┐
        │  Auto Envoi PDF +   │
        │  Email Téléchargement
        └─────────────────────┘
```

---

## 📥 PHASE 4 : Système de Téléchargement Limité (Semaine 2)

### 4.1 Règles Téléchargement

```javascript
// Règles strictes
- Limite 2 téléchargements par achat
- URL de téléchargement expire après 30 jours
- Chaque lien est tokenisé et tracé
- Impossible de télécharger après 2 tentatives
- Vérification IP + User-Agent
- Logs d'accès complets
```

### 4.2 Workflow Téléchargement

```
1. Achat → Paiement validé
2. Email reçu avec lien unique + code
3. Clic lien → Compteur += 1 (MAX 2)
4. Téléchargement PDF
5. 2e tentative bloquée après succès
6. Email d'alerte si tentative suspecte
```

---

## 👥 PHASE 5 : Dashboards Utilisateurs (Semaine 3)

### 5.1 Dashboard Auteur
```
- Ses livres publiés
- Statistiques ventes (mensuel)
- Gains et commissions
- Gestion des livres (upload, édition, suppression)
- Données bancaires pour virement
- Historique des téléchargements
- Évaluations/Avis
```

### 5.2 Dashboard Éditeur
```
- Ses livres édités
- Gestion auteurs (invitation, contrats)
- Statistiques complètes
- Commission éditeur
- Gestion catalogue
- Rapports analytiques
```

### 5.3 Dashboard Vendeur
```
- Livres en revente
- Inventaire
- Commissions spécifiques par livre
- Statistiques ventes personnelles
- Gestion boutique (nom, logo, description)
- Paiements reçus
```

### 5.4 Dashboard Admin
```
- Statistiques globales
- Gestion utilisateurs (vérification)
- Modération contenu
- Gestion paiements (rapprochement manuel)
- Rapports fiscaux
- Gestion commissions
- Logs accès système
```

### 5.5 Dashboard Client
```
- Mes commandes
- Mes téléchargements (avec compteur)
- Lien direct téléchargement (valide 30j, 2 fois max)
- Historique d'achat
- Mes avis/notes
- Profil
```

---

## 🔐 PHASE 6 : Sécurité & Authentification (Semaine 3)

### 6.1 Sécurité
```
- NextAuth.js (authentification)
- JWT tokens
- Hash mot de passe (bcrypt)
- Vérification email
- 2FA optionnel pour admin
- HTTPS obligatoire
- Validation CSRF
- Rate limiting API
- Logs audit complets
```

### 6.2 Protection PDF
```
- Lien unique par téléchargement
- URL expire après 30 jours
- Token encodé + signature
- Impossible de partager le lien
- Vérification IP/User-Agent
- Compte à rebours visible (2 téléchargements restants)
```

---

## 📧 PHASE 7 : Emails Automatisés (Semaine 3)

### 7.1 Templates Email

```
1. Confirmation inscription
2. Validation email auteur/éditeur/vendeur
3. Bienvenue sur la plateforme
4. Commande confirmée
5. Paiement reçu + Lien téléchargement
6. Rappel avant expiration lien (Jour 25/30)
7. Accès expiré
8. Commission mensuelle versée
9. Rappel compléter profil
10. Alerte sécurité (tentative suspecte)
```

---

## 📱 PHASE 8 : Frontend Public & Boutique (Semaine 4)

### 8.1 Pages Publiques
```
- Accueil
- Catalogue livres (filtres, recherche, tri)
- Détail livre (aperçu, avis, auteur)
- Authentification (login, register)
- Profil auteur public
- À propos / Contact
- Conditions d'utilisation
- Politique confidentialité
```

### 8.2 Panier & Checkout
```
- Ajout au panier
- Voir panier
- Appliquer code promo (futur)
- Récapitulatif paiement
- Sélection méthode paiement
- Processus paiement étapé
- Confirmation finale
```

---

## 🚀 PHASE 9 : Optimisation & Déploiement (Semaine 5)

### 9.1 Optimisation
```
- Compression images
- Cache navigateur
- CDN pour PDF
- Minification code
- Lazy loading
- SEO optimisé
- Performance LightHouse 90+
```

### 9.2 Déploiement
```
- Repository: GitHub (jbaime23-bit/techlibrairie)
- Hosting: Vercel (frontend) / Railway/Render (backend)
- Base données: PostgreSQL Cloud
- Stockage: AWS S3 / Supabase Storage
- Email: SendGrid / Brevo
- CDN: Cloudflare
- Monitoring: Sentry / LogRocket
```

---

## 📊 Timeline Complet

| Phase | Tâches | Durée | Status |
|-------|--------|-------|--------|
| 1 | Architecture & Setup | 3-4 jours | À faire |
| 2 | Database & Models | 3-4 jours | À faire |
| 3 | API Paiement | 4-5 jours | À faire |
| 4 | Système téléchargement | 2-3 jours | À faire |
| 5 | Dashboards | 5-6 jours | À faire |
| 6 | Sécurité & Auth | 3-4 jours | À faire |
| 7 | Emails automatisés | 2-3 jours | À faire |
| 8 | Frontend public | 5-6 jours | À faire |
| 9 | Déploiement | 2-3 jours | À faire |
| **TOTAL** | | **~35-40 jours** | |

---

## 🎯 Prochaines Étapes

1. **Valider le plan** ✓
2. **Créer configuration environment** → `.env.local`
3. **Initialiser Prisma** → Schema DB
4. **Setup NextAuth** → Authentification
5. **Créer API paiement** → Orange/Moov/Virement
6. **Développer UI boutique** → Catalogue & panier
7. **Déployer V1** → MVP fonctionnel

---

## 📝 Notes Importantes

- **Commission par profil**: Auteur 50%, Éditeur 30%, Vendeur 15%, Plateforme 5%
- **Devise**: XOF (Franc CFA) par défaut, convertible
- **Téléchargement limité**: 2 fois max, 30 jours validité
- **Paiement sécurisé**: Tous les paiements cryptés & vérifiés
- **Conformité**: RGPD, conditions légales, KYC vendeurs

---

**Créé par**: Copilot  
**Date**: 2026-10-01  
**Version**: 1.0
