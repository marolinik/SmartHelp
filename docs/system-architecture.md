# PIO Help Desk System - Arhitektura Sistema

## 🏗️ Pregled Sistemske Arhitekture

### Cilj
Projektovanje skalabilne, bezbedne i održive ITSM platforme za PIO Fond Srbije sa podrškom za 1.000+ korisnika, focusing on Serbian language as primary interface.

### Ključni Principi
- **Serbian-First Design**: Svi UI elementi, poruke i validacije na srpskom jeziku
- **Mikroservisi Arhitektura**: Modularna struktura za lakše održavanje
- **Cloud-Native**: Kontejnerizovana aplikacija sa Kubernetes podrškom
- **Bezbednost**: Multi-layer security sa AD integracijom
- **Skalabilnost**: Horizontalno skaliranje komponenti
- **Pristupačnost**: WCAG 2.1 AA compliance

## 🎯 High-Level Arhitektura

```
┌─────────────────────────────────────────────────────────────────┐
│                    KORISNIČKI SLOJ                               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   End Users     │  L1/L2/L3       │     Admin Users             │
│   (1000+)       │  Agents         │     (Managers)              │
└─────────┬───────┴─────────┬───────┴─────────────┬───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION SLOJ                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Self-Service   │   Agent Portal  │    Admin Dashboard          │
│    Portal       │   (React SPA)   │     (React SPA)             │
│  (React SPA)    │                 │                             │
└─────────┬───────┴─────────┬───────┴─────────────┬───────────────┘
          │                 │                     │
          └─────────────────┼─────────────────────┘
                            │
                ┌───────────▼───────────┐
                │     API Gateway       │
                │   (NGINX/Traefik)     │
                │  - Load Balancing     │
                │  - Rate Limiting      │
                │  - Authentication     │
                └───────────┬───────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MICROSERVICES SLOJ                             │
├─────────────┬──────────────┬──────────────┬─────────────────────┤
│    Auth     │   Ticket     │   Knowledge  │    Notification     │
│  Service    │  Service     │    Base      │     Service         │
│             │              │   Service    │                     │
├─────────────┼──────────────┼──────────────┼─────────────────────┤
│   User      │    SLA       │   Reporting  │      AI/ML          │
│ Management  │  Service     │   Service    │     Service         │
│  Service    │              │              │                     │
└─────────────┴──────────────┴──────────────┴─────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SLOJ                                   │
├─────────────┬──────────────┬──────────────┬─────────────────────┤
│ PostgreSQL  │    Redis     │ Elasticsearch│     File Storage    │
│ (Primary)   │   (Cache)    │   (Search)   │    (MinIO/S3)       │
│             │              │              │                     │
└─────────────┴──────────────┴──────────────┴─────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                           │
├─────────────┬──────────────┬──────────────┬─────────────────────┤
│Active Dir.  │    Email     │   Vendor     │     CORE 1          │
│   (LDAP)    │  (SMTP)      │   Systems    │    System           │
│             │              │              │                     │
└─────────────┴──────────────┴──────────────┴─────────────────────┘
```

## 🏢 Mikroservisi Arhitektura

### 1. Authentication Service (Auth Service)
**Odgovornost**: Autentifikacija, autorizacija, upravljanje sesijama

**Tehnologije**:
- Node.js + Express + TypeScript
- JWT za token management
- bcrypt za password hashing
- Active Directory/LDAP integration

**API Endpoints**:
```
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/profile
PUT  /auth/profile
POST /auth/change-password
```

**Database Schema**:
```sql
-- Korisnici (UTF-8 za srpska imena)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL, -- Ime (UTF-8)
    last_name VARCHAR(100) NOT NULL,  -- Prezime (UTF-8)
    display_name VARCHAR(200),        -- Puno ime za prikaz
    role_id UUID REFERENCES roles(id),
    department VARCHAR(100),          -- Odeljenje (UTF-8)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Uloge sistema
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,   -- end_user, l1_agent, l2_specialist, etc.
    display_name VARCHAR(100) NOT NULL, -- Naziv uloge na srpskom
    description TEXT,                   -- Opis uloge na srpskom
    permissions JSONB NOT NULL,         -- Array permisija
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Ticket Management Service
**Odgovornost**: CRUD operacije za tikete, workflow management, escalation

**Tehnologije**:
- Node.js + Express + TypeScript
- Prisma ORM
- Bull queue za async processing
- Socket.io za real-time updates

**API Endpoints**:
```
POST   /tickets
GET    /tickets
GET    /tickets/:id
PUT    /tickets/:id
DELETE /tickets/:id
POST   /tickets/:id/comments
POST   /tickets/:id/attachments
PUT    /tickets/:id/status
PUT    /tickets/:id/assign
POST   /tickets/:id/escalate
```

**Database Schema**:
```sql
-- Tiketi (optimizovano za srpski sadržaj)
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(20) UNIQUE NOT NULL, -- YYYYMMDD-NNNN format
    title VARCHAR(255) NOT NULL,               -- Naslov tiketa (UTF-8)
    description TEXT NOT NULL,                 -- Opis problema (UTF-8)
    category_id UUID REFERENCES categories(id),
    priority priority_enum NOT NULL DEFAULT 'medium',
    status status_enum NOT NULL DEFAULT 'new',
    requester_id UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    sla_due_date TIMESTAMP,
    resolution_notes TEXT,                     -- Napomene rešenja (UTF-8)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP
);

-- Kategorije (srpski nazivi)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,               -- Naziv kategorije (UTF-8)
    description TEXT,                         -- Opis kategorije (UTF-8)
    parent_id UUID REFERENCES categories(id), -- Hierarchical structure
    sla_response_hours INTEGER DEFAULT 8,
    sla_resolution_hours INTEGER DEFAULT 24,
    ai_keywords TEXT[],                       -- Ključne reči za AI kategorizaciju
    created_at TIMESTAMP DEFAULT NOW()
);

-- Komentari na tiketima
CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    content TEXT NOT NULL,                    -- Sadržaj komentara (UTF-8)
    is_public BOOLEAN DEFAULT true,           -- Javni ili interno
    created_at TIMESTAMP DEFAULT NOW()
);

-- Prilozi
CREATE TABLE ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,          -- Ime fajla (UTF-8)
    original_name VARCHAR(255) NOT NULL,     -- Originalno ime (UTF-8)
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Knowledge Base Service
**Odgovornost**: Upravljanje bazom znanja, search, approval workflow

**Tehnologije**:
- Node.js + Express + TypeScript
- Elasticsearch sa Serbian analyzer
- Prisma ORM
- Rich text editor support

**API Endpoints**:
```
POST   /kb/articles
GET    /kb/articles
GET    /kb/articles/:id
PUT    /kb/articles/:id
DELETE /kb/articles/:id
POST   /kb/articles/:id/approve
POST   /kb/articles/:id/reject
GET    /kb/search?q=:query
POST   /kb/articles/:id/feedback
GET    /kb/categories
```

**Database Schema**:
```sql
-- Članci baze znanja
CREATE TABLE kb_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,             -- Naslov članka (UTF-8)
    content TEXT NOT NULL,                   -- Sadržaj članka (UTF-8)
    summary TEXT,                            -- Kratak opis (UTF-8)
    category_id UUID REFERENCES kb_categories(id),
    author_id UUID REFERENCES users(id),
    status article_status_enum DEFAULT 'draft',
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    tags TEXT[],                             -- Tagovi za pretragu
    meta_keywords TEXT,                      -- SEO ključne reči
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Kategorije baze znanja
CREATE TABLE kb_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,             -- Naziv kategorije (UTF-8)
    description TEXT,                       -- Opis kategorije (UTF-8)
    parent_id UUID REFERENCES kb_categories(id),
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50),                       -- Material icon naziv
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Feedback na članke
CREATE TABLE kb_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES kb_articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    is_helpful BOOLEAN NOT NULL,            -- true = helpful, false = not helpful
    comment TEXT,                           -- Komentar korisnika (UTF-8)
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. SLA Management Service
**Odgovornost**: SLA praćenje, eskalacija, compliance reporting

**Tehnologije**:
- Node.js + Express + TypeScript
- Cron jobs za SLA checking
- Redis za caching SLA data
- Notification integration

**Database Schema**:
```sql
-- SLA definicije
CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,             -- Naziv SLA politike (UTF-8)
    description TEXT,                       -- Opis politike (UTF-8)
    priority priority_enum NOT NULL,
    category_id UUID REFERENCES categories(id),
    response_time_hours INTEGER NOT NULL,    -- Vreme odgovora u satima
    resolution_time_hours INTEGER NOT NULL, -- Vreme rešavanja u satima
    business_hours_only BOOLEAN DEFAULT true,
    escalation_rules JSONB,                 -- Pravila eskalacije
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pracenje SLA po tiketima
CREATE TABLE sla_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES sla_policies(id),
    response_due_date TIMESTAMP NOT NULL,
    resolution_due_date TIMESTAMP NOT NULL,
    first_response_at TIMESTAMP,
    resolved_at TIMESTAMP,
    response_breached BOOLEAN DEFAULT false,
    resolution_breached BOOLEAN DEFAULT false,
    breach_reason TEXT,                     -- Razlog kršenja SLA (UTF-8)
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. AI/ML Service
**Odgovornost**: Automatska kategorizacija, chatbot, smart routing

**Tehnologije**:
- Python + FastAPI
- OpenAI API
- Scikit-learn za ML modele
- Spacy za NLP sa srpskim jezikom

**API Endpoints**:
```
POST /ai/categorize-ticket
POST /ai/suggest-assignment
POST /ai/chatbot/message
GET  /ai/knowledge-suggestions
POST /ai/analyze-sentiment
```

### 6. Notification Service
**Odgovornost**: Email, SMS, in-app notifikacije

**Tehnologije**:
- Node.js + Express + TypeScript
- Nodemailer za email
- Template engine (Handlebars)
- Bull queue za async delivery

**Database Schema**:
```sql
-- Template-i notifikacija
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,             -- Naziv template-a
    subject VARCHAR(255) NOT NULL,          -- Naslov (UTF-8)
    body_html TEXT NOT NULL,                -- HTML sadržaj (UTF-8)
    body_text TEXT NOT NULL,                -- Text sadržaj (UTF-8)
    variables JSONB,                        -- Dostupne varijable
    language VARCHAR(5) DEFAULT 'sr',       -- sr, en
    created_at TIMESTAMP DEFAULT NOW()
);

-- Log notifikacija
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES users(id),
    type notification_type_enum NOT NULL,   -- email, sms, push, in_app
    subject VARCHAR(255),                   -- Naslov (UTF-8)
    content TEXT,                           -- Sadržaj (UTF-8)
    status delivery_status_enum DEFAULT 'pending',
    sent_at TIMESTAMP,
    error_message TEXT,                     -- Poruka greške (UTF-8)
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🗄️ Database Design Principi

### UTF-8 Encoding
```sql
-- Kreiranje baze sa UTF-8 podrškom
CREATE DATABASE pio_helpdesk 
    WITH ENCODING 'UTF8' 
    LC_COLLATE = 'sr_RS.UTF-8' 
    LC_CTYPE = 'sr_RS.UTF-8' 
    TEMPLATE = template0;
```

### Indeksi za Performance
```sql
-- Indeksi za srpske tekstove
CREATE INDEX idx_tickets_title_gin ON tickets USING gin(to_tsvector('serbian', title));
CREATE INDEX idx_tickets_description_gin ON tickets USING gin(to_tsvector('serbian', description));
CREATE INDEX idx_kb_articles_content_gin ON kb_articles USING gin(to_tsvector('serbian', content));

-- Composite indeksi
CREATE INDEX idx_tickets_status_created ON tickets(status, created_at);
CREATE INDEX idx_tickets_assigned_status ON tickets(assigned_to, status);
CREATE INDEX idx_sla_tracking_due_dates ON sla_tracking(response_due_date, resolution_due_date);
```

## 🔐 Security Architecture

### Authentication Flow
```
1. User Login → AD/LDAP Verification
2. Generate JWT Token (24h expiry)
3. Store Refresh Token (Redis, 30 days)
4. Return Access + Refresh Tokens
5. API calls include Bearer token
6. Token refresh before expiry
```

### Authorization Matrix
```
| Resource        | End User | L1 Agent | L2 Specialist | L3 Expert | Admin |
|----------------|----------|----------|---------------|-----------|-------|
| Create Ticket  |    ✓     |    ✓     |       ✓       |     ✓     |   ✓   |
| View Own       |    ✓     |    ✓     |       ✓       |     ✓     |   ✓   |
| View All       |    ✗     |    ✓     |       ✓       |     ✓     |   ✓   |
| Assign Tickets |    ✗     |    ✓     |       ✓       |     ✓     |   ✓   |
| Escalate       |    ✗     |    ✓     |       ✓       |     ✓     |   ✓   |
| Approve KB     |    ✗     |    ✗     |       ✓       |     ✓     |   ✓   |
| System Config  |    ✗     |    ✗     |       ✗       |     ✗     |   ✓   |
```

## 📊 Scalability & Performance

### Horizontal Scaling Strategy
- **API Gateway**: Load balancing across multiple instances
- **Microservices**: Independent scaling based on load
- **Database**: Read replicas for reporting queries
- **Cache**: Redis cluster for high availability
- **File Storage**: Distributed object storage

### Performance Targets
- **API Response**: < 500ms (95th percentile)
- **Search Queries**: < 2 seconds
- **Page Load**: < 3 seconds
- **Concurrent Users**: 100+
- **Ticket Throughput**: 1000+ daily

### Caching Strategy
```
- Redis Cache Layers:
  ├── Session Data (30 min TTL)
  ├── User Profiles (4 hours TTL)
  ├── KB Articles (1 hour TTL)
  ├── Category Trees (24 hours TTL)
  └── Search Results (15 min TTL)
```

## 🔄 Data Flow Architecture

### Ticket Creation Flow
```
1. Frontend (React) → API Gateway
2. API Gateway → Auth Service (validate JWT)
3. Auth Service → Ticket Service
4. Ticket Service → AI Service (categorization)
5. AI Service → Ticket Service (suggested category)
6. Ticket Service → Database (create ticket)
7. Ticket Service → SLA Service (calculate due dates)
8. SLA Service → Notification Service (assign notifications)
9. Response back to Frontend
```

### Real-time Updates
```
- WebSocket Connections (Socket.io)
- Event Broadcasting:
  ├── Ticket Status Changes
  ├── New Comments/Attachments
  ├── SLA Warnings
  └── Assignment Changes
```

## 🌐 Internationalization (i18n) Architecture

### Language Support Strategy
```
Primary Language: Serbian (Cyrillic & Latin)
├── UI Labels: React i18next
├── Validation Messages: Joi + i18next
├── Email Templates: Handlebars + i18n
├── Error Messages: Custom error handlers
└── Database Content: UTF-8 storage

Future Language: English
├── Secondary implementation
├── User preference-based
├── Admin configurable
└── Gradual rollout
```

### Serbian Language Implementation
```typescript
// i18n Configuration
const i18nConfig = {
  lng: 'sr', // Serbian as default
  fallbackLng: 'sr',
  interpolation: {
    escapeValue: false
  },
  resources: {
    sr: {
      translation: {
        'ticket.create': 'Kreiraj tiket',
        'ticket.status.new': 'Novi',
        'ticket.status.in_progress': 'U radu',
        'ticket.status.resolved': 'Rešen',
        'sla.breach.warning': 'Upozorenje - SLA se prekršava',
        // ... ostali prevodi
      }
    }
  }
};
```

## 📋 Implementation Phases

### Phase 1: Core Foundation (Months 1-3)
- ✅ Development Environment Setup
- 🔄 **System Architecture (Current)**
- ⏳ Authentication Service
- ⏳ Basic Ticket Management
- ⏳ Core Database Schema
- ⏳ API Gateway Setup

### Phase 2: Enhanced Features (Months 3-4)
- ⏳ Knowledge Base Service
- ⏳ SLA Management
- ⏳ Self-Service Portal
- ⏳ Advanced Reporting
- ⏳ Email Integration

### Phase 3: AI & Advanced Features (Months 4-6)
- ⏳ AI/ML Service Implementation
- ⏳ Chatbot Development
- ⏳ Advanced Analytics
- ⏳ External System Integrations
- ⏳ Mobile Application

---

**Poslednja Izmena**: 30. maj 2025.
**Status**: In Progress - Implementacija Phase 1
**Sledeći Korak**: Implementacija Authentication Service 