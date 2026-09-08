# Requirements d'hébergement — Application PCP16

## 1. Présentation

Application web d'inventaire de lots PCP16 pour la gestion collaborative d'inventaires.  
Architecture frontend/backend séparée, données persistées en base de données relationnelle.

---

## 2. Langages et runtimes

| Composant | Langage / Runtime | Version minimale |
|-----------|-------------------|------------------|
| Frontend | JavaScript / TypeScript | TypeScript ≥ 5.5 |
| Frontend (build) | Node.js | ≥ 18.x (ESM support) |
| Backend | Python | ≥ 3.10 (async/await, type hints) |

---

## 3. Frontend

### 3.1 Stack technique

| Technologie | Version | Rôle |
|-------------|---------|------|
| React | ≥ 18.3 | Framework UI |
| Vite | ≥ 5.4 | Build tool & dev server |
| Tailwind CSS | ≥ 3.4 | Framework CSS utilitaire |
| shadcn/ui (Radix UI) | — | Composants UI accessibles |
| React Router DOM | ≥ 6.30 | Navigation SPA |
| TanStack React Query | ≥ 5.56 | Requêtes asynchrones & cache |
| Axios | 1.6 | Client HTTP |
| Zod | ≥ 3.23 | Validation de schémas |
| React Hook Form | ≥ 7.53 | Gestion de formulaires |
| date-fns | ≥ 3.6 | Manipulation de dates |
| Recharts | ≥ 2.12 | Graphiques |
| Lucide React | ≥ 0.462 | Icônes |

### 3.2 Build

- Commande de build : `npm run build` (Vite → dossier `dist/`)
- Output : fichiers statiques (HTML, JS, CSS) — servables par n'importe quel serveur web statique ou CDN
- Port dev par défaut : 3000
- Proxy API en dev : `/api` → `http://localhost:8000`

### 3.3 Hébergement frontend

Le frontend est une **SPA (Single Page Application)** compilée en fichiers statiques.  
Options d'hébergement compatibles :

- **Serveur statique** : Nginx, Apache, Caddy — servir le dossier `dist/`
- **CDN / Edge** : Cloudflare Pages, Vercel, Netlify, AWS CloudFront + S3
- **Configuration requise** :
  - Toutes les routes doivent rediriger vers `index.html` (fallback SPA)
  - MIME type `.js` → `application/javascript`, `.css` → `text/css`
  - Compression gzip/brotli recommandée

---

## 4. Backend

### 4.1 Stack technique

| Technologie | Version | Rôle |
|-------------|---------|------|
| FastAPI | ≥ 0.110 | Framework web asynchrone |
| Uvicorn | ≥ 0.29 (avec `[standard]`) | Serveur ASGI |
| Pydantic | ≥ 2.11, < 3.0 | Validation & sérialisation |
| Pydantic Settings | ≥ 2.8, < 3.0 | Configuration env vars |
| SQLAlchemy | ≥ 2.0 | ORM asynchrone |
| Alembic | ≥ 1.13 | Migrations de base de données |
| asyncpg | ≥ 0.29 | Driver PostgreSQL asynchrone |
| python-jose | ≥ 3.3 | JWT / authentification |
| Mangum | 0.19 | Adaptateur AWS Lambda |
| Stripe | ≥ 12.0 | Paiements (optionnel) |
| OpenAI | 2.16 | IA / LLM (optionnel) |

### 4.2 Serveur

- Port par défaut : 8000
- Protocole : HTTP/HTTPS (ASGI)
- CORS : toutes origines autorisées (`allow_origin_regex=.*`)
- Health check : `GET /health` → `{"status": "healthy"}`

### 4.3 Hébergement backend

Options d'hébergement compatibles :

- **Serveur dédié** : Uvicorn + Gunicorn (workers ASGI)
- **Conteneur Docker** : image Python 3.10+, exposition port 8000
- **Serverless** : AWS Lambda + API Gateway (adaptateur Mangum inclus)
- **PaaS** : Render, Railway, Fly.io, Heroku
- **Variables d'environnement requises** :
  - `DATABASE_URL` — URL de connexion à la base de données (obligatoire)
  - `ENVIRONMENT` — `dev` ou `prod` (défaut : `prod`)
  - `PORT` — port d'écoute (défaut : `8000`)

---

## 5. Base de données

### 5.1 Base principale : PostgreSQL

| Paramètre | Valeur |
|-----------|--------|
| SGBD | **PostgreSQL** ≥ 12 |
| Driver | asyncpg (asynchrone) |
| ORM | SQLAlchemy 2.0 (async) |
| Charset | UTF-8 |
| SSL | Supporté (sslmode configurable) |

### 5.2 Tables applicatives

| Table | Rôle |
|-------|------|
| `inventory_sessions` | Sessions d'inventaire actives (lot, variante, DPS, type intervention) |
| `inventory_items` | Articles inventoriés (conforme, quantité, écarts) |
| `sub_entity_checks` | État de vérification des sous-ensembles |
| `inventory_logs` | Journal des interventions (vérifications & désinfections) |
| `discrepancy_reports` | Rapports d'écart par lot+variante |
| `lot_configs` | Configurations dynamiques des lots |
| `app_preferences` | Préférences utilisateur cloud |

### 5.3 Connexion

- URL format : `postgresql+asyncpg://user:password@host:port/database`
- Pool de connexions :
  - Hors Lambda : QueuePool (taille 10, overflow 20, recycle 1h, timeout 30s)
  - Lambda : NullPool (connexion fraîche par requête)
- Paramètres incompatibles auto-supprimés : `channel_binding`, `sslmode`

### 5.4 Bases alternatives (support code existant)

| SGBD | Driver | Statut |
|------|--------|--------|
| SQLite | aiosqlite | Supporté (développement local) |
| MySQL / MariaDB | aiomysql | Supporté (code présent, non testé en prod) |

> **Recommandation production** : PostgreSQL exclusivement.

---

## 6. Déploiement AWS Lambda (optionnel)

| Paramètre | Valeur |
|-----------|--------|
| Adaptateur | Mangum 0.19 |
| Variable `IS_LAMBDA` | `true` |
| Variable `AWS_LAMBDA_FUNCTION_NAME` | Nom de la fonction Lambda |
| Variable `AWS_REGION` | Région (défaut : `us-east-1`) |
| Pool DB | NullPool (pas de connexion persistée entre invocations) |

---

## 7. Réseau & sécurité

| Aspect | Configuration |
|--------|---------------|
| CORS | Toutes origines autorisées (`*`) |
| Authentification | Pas d'auth utilisateur (nom DPS saisi manuellement) ; JWT disponible côté backend si besoin |
| HTTPS | Obligatoire en production |
| Rate limiting | Backoff exponentiel côté client sur HTTP 429 |
| Headers | FastAPI default security headers |

---

## 8. Stockage de fichiers

- Pas de stockage de fichiers utilisateur requis actuellement
- Les données PDF source sont intégrées au code (`/workspace/uploads/`)
- Si upload futur : stockage objet (S3, GCS, ou Atoms Cloud File Storage)

---

## 9. Dépendances système

| Dépendance | Version | Rôle |
|------------|---------|------|
| Node.js | ≥ 18.x | Build frontend |
| npm | ≥ 9.x | Gestionnaire de paquets frontend |
| Python | ≥ 3.10 | Runtime backend |
| pip | ≥ 23.x | Gestionnaire de paquets backend |
| PostgreSQL | ≥ 12 | Base de données |

---

## 10. Checklist de déploiement

- [ ] **Base de données PostgreSQL** provisionnée et accessible
- [ ] **Variable `DATABASE_URL`** configurée avec les identifiants de connexion
- [ ] **Frontend buildé** (`npm run build`) et fichiers `dist/` déployés
- [ ] **Serveur statique** configuré avec fallback SPA (`index.html` pour toutes les routes)
- [ ] **Backend démarré** (Uvicorn/FastAPI sur port 8000)
- [ ] **Proxy inverse** configuré : `/api` → backend (si frontend et backend sur même domaine)
- [ ] **CORS** vérifié si frontend et backend sur domaines différents
- [ ] **HTTPS** activé en production
- [ ] **Health check** `GET /health` répond `200`
- [ ] **Tables créées** automatiquement au premier démarrage (SQLAlchemy `create_all`)

---

## 11. Architecture résumée

```
┌─────────────────────┐       ┌─────────────────────┐
│   Frontend (SPA)    │       │   Backend (API)     │
│   React + Vite      │  ──→  │   FastAPI + Uvicorn │
│   Fichiers statiques│  /api │   Python 3.10+      │
│   Port 3000 (dev)   │       │   Port 8000         │
└─────────────────────┘       └──────────┬──────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   PostgreSQL ≥ 12   │
                              │   asyncpg driver    │
                              │   SQLAlchemy 2.0    │
                              └─────────────────────┘
```

---

*Document généré le 2026-09-08 à partir de la configuration du projet PCP16.*