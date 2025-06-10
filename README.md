# PIO Fund Help Desk System

## 🏛️ Sistem za Help Desk PIO Fonda Srbije

Sveobuhvatan IT Help Desk sistem sa AI-powered ITSM platformom za PIO Fond Srbije, sa podrškom za približno 1.000 korisnika širom više filijala.

### 🎯 Projektni Ciljevi

- **Implementacija tri-nivojske podrške** (L1, L2, L3) u skladu sa ITSM najboljim praksama
- **AI-powered automatizacija** sa inteligentnim rutiranjem tiketa
- **Self-service portal** sa AI chatbot-om
- **Centralizovana baza znanja** sa AI-powered preporukama
- **SLA upravljanje i praćenje**
- **Sveobuhvatno izveštavanje i analitika**

### 🚀 Tehnologije

**Frontend:**
- React 18 sa TypeScript
- Material-UI (MUI) komponente
- Redux Toolkit za state management
- React Router za navigaciju
- React i18next za srpski jezik (primarno)
- Vite za build tool

**Backend:**
- Node.js sa Express framework
- TypeScript za type safety
- PostgreSQL baza podataka sa Prisma ORM
- Redis za caching i task queue
- Socket.io za real-time komunikaciju
- JWT autentifikacija sa Active Directory integracijom

**AI/ML:**
- OpenAI API za chatbot i NLP
- Automatska kategorizacija tiketa
- Inteligentno rutiranje
- Preporučivanje članaka iz baze znanja

### 🏗️ Struktura Projekta

```
├── frontend/           # React TypeScript aplikacija
│   ├── src/
│   │   ├── components/ # Reusable komponente
│   │   ├── pages/      # Stranice aplikacije
│   │   ├── store/      # Redux store
│   │   ├── services/   # API servisi
│   │   ├── i18n/       # Srpski jezik fajlovi
│   │   └── types/      # TypeScript definicije
│   └── package.json
├── backend/            # Node.js Express API
│   ├── src/
│   │   ├── controllers/# Route controllers
│   │   ├── models/     # Database modeli
│   │   ├── routes/     # API rute
│   │   ├── middleware/ # Express middleware
│   │   ├── services/   # Business logic
│   │   └── database/   # DB konfiguracija
│   └── package.json
├── docs/               # Dokumentacija
├── tests/              # Test fajlovi
└── package.json        # Root package.json
```

### 🛠️ Instalacija i Pokretanje

#### Preduslovi
- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL 14+
- Redis (opciono, za caching)

#### Kloniranje i instalacija
```bash
# Kloniranje repozitorijuma
git clone <repository-url>
cd pio-help-desk-system

# Instalacija svih dependencies
npm run install:all

# Ili pojedinačno
npm install                 # Root dependencies
cd frontend && npm install  # Frontend dependencies
cd ../backend && npm install # Backend dependencies
```

#### Konfiguracija baze podataka
```bash
# U backend direktorijumu
cd backend

# Kreiranje .env fajla (kopiraj sa .env.example)
cp .env.example .env

# Edituj .env sa tvojim PostgreSQL podacima
# DATABASE_URL="postgresql://username:password@localhost:5432/pio_helpdesk"

# Generisanje Prisma klijenta
npm run db:generate

# Pokretanje migracija
npm run db:migrate

# Seed početnih podataka (opciono)
npm run db:seed
```

#### Pokretanje za development
```bash
# Iz root direktorijuma - pokretanje i frontend i backend
npm run dev

# Ili pojedinačno
npm run dev:frontend   # Frontend na http://localhost:3000
npm run dev:backend    # Backend API na http://localhost:5000
```

### 📋 Faze Implementacije

**Faza 1: Osnova (Meseci 1-3)**
- ✅ Setup development environment
- ⏳ Osnovno ticket management
- ⏳ Autentifikacija (AD integracija)
- ⏳ Osnovno izveštavanje
- **Cilj:** Demo spreman do 13. maja 2025

**Faza 2: Proširene mogućnosti (Meseci 3-4)**
- ⏳ Kompletna implementacija workflow-a
- ⏳ Baza znanja sa approval workflow
- ⏳ SLA upravljanje
- ⏳ Self-service portal
- **Cilj:** Produkcija spremna do 3. jula 2025

**Faza 3: AI i automatizacija (Meseci 4-6)**
- ⏳ AI chatbot deployment
- ⏳ Napredna analitika
- ⏳ Prediktivni uvidi
- ⏳ Integracije sa eksternim sistemima
- **Cilj:** Pune mogućnosti do septembra 2025

### 🧪 Testiranje

```bash
# Pokretanje testova
npm test

# Test coverage
npm run test:coverage

# Linting
npm run lint

# Formatiranje koda
npm run format
```

### 🌐 Jezička Podrška

Sistem je primarno razvijen za **srpski jezik** sa mogućnošću dodavanja engleskog jezika u kasnijim fazama:

- **Primarni jezik:** Srpski (все komponente UI)
- **Sekundarni jezik:** Engleski (planiran za buduće verzije)
- **Lokalizacija:** Srpski datumski format, brojevi, valuta

### 📊 Monitoring i Logging

- **Winston** za backend logging
- **Error tracking** za production environment
- **Performance monitoring** sa metrics
- **Health checks** za system monitoring

### 🔐 Bezbednost

- **JWT tokeni** za autentifikaciju
- **Helmet.js** za HTTP headers security
- **Rate limiting** za API protection
- **Input validation** sa Joi
- **HTTPS** u production environment

### 📝 Dokumentacija

- API dokumentacija: `/docs/api.md`
- User manual: `/docs/user-guide.md`
- Admin guide: `/docs/admin-guide.md`
- Development guide: `/docs/development.md`

### 🤝 Doprinošenje

1. Fork repozitorijum
2. Kreiraj feature branch (`git checkout -b feature/nova-funkcionalnost`)
3. Commit promene (`git commit -am 'Dodaj novu funkcionalnost'`)
4. Push na branch (`git push origin feature/nova-funkcionalnost`)
5. Kreiraj Pull Request

### 📞 Podrška

Za podršku kontaktiraj:
- IT Sektor PIO Fonda
- Email: it-support@pio.gov.rs
- Telefon: +381 11 xxx-xxxx

---

**Copyright © 2025 PIO Fond Srbije. Sva prava zadržana.** 