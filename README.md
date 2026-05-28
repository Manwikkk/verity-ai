# Verity -- Multi-Tenant RAG Knowledge Workspace

A production-grade Retrieval-Augmented Generation system built with Node.js, TypeScript, Fastify, PostgreSQL (pgvector), and a React frontend. Organizations upload PDFs, policies, and manuals, then query only their own tenant-scoped knowledge base with guardrails against prompt injection, cross-tenant leakage, and low-confidence retrieval.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Architecture Diagram](#system-architecture-diagram)
- [RAG Pipeline](#rag-pipeline)
- [Document Processing Pipeline](#document-processing-pipeline)
- [Query Flow](#query-flow)
- [Multi-Tenant Isolation](#multi-tenant-isolation)
- [Guardrails](#guardrails)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Bonus Features](#bonus-features)
- [Evaluation Criteria Coverage](#evaluation-criteria-coverage)

---

## Architecture Overview

Verity follows a layered architecture with strict separation between the API layer, business logic, and data access. Every request passes through authentication middleware and tenant isolation checks before reaching the service layer.

```mermaid
graph TB
    subgraph Client["Frontend -- React + TanStack Start"]
        UI["Web Application<br/>React 19 + TanStack Router"]
        SSR["Server-Side Rendering<br/>Vite + Cloudflare Workers"]
    end

    subgraph API["Backend -- Fastify + TypeScript"]
        Routes["Route Layer<br/>auth | tenant | document | query | chat | search | settings | health"]
        MW["Middleware<br/>JWT Auth | Tenant Isolation | RBAC | Rate Limiting"]
        Services["Service Layer<br/>AuthService | TenantService | DocumentService | QueryService | ChatService"]
        RAG["RAG Engine<br/>Chunker | Embeddings | Retrieval | Reranker | Confidence | Generator | Guardrails"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL 16<br/>pgvector extension"]
        Redis["Redis 7<br/>Session cache + Rate limiting"]
        FS["File Storage<br/>Document uploads"]
    end

    subgraph External["External Services"]
        LLM["LLM Providers<br/>Groq | OpenAI | Gemini | Anthropic"]
        EMB["Embedding Model<br/>all-MiniLM-L6-v2 via Xenova"]
        GAUTH["Google OAuth<br/>Identity provider"]
    end

    UI --> SSR
    SSR --> Routes
    Routes --> MW
    MW --> Services
    Services --> RAG
    Services --> PG
    Services --> Redis
    RAG --> PG
    RAG --> LLM
    RAG --> EMB
    Services --> FS
    Routes --> GAUTH
```

---

## RAG Pipeline

The core retrieval-augmented generation pipeline processes user queries through multiple stages, each with its own guardrail and quality checks.

```mermaid
flowchart LR
    A["User Query"] --> B["Guardrails Check"]
    B -->|Blocked| C["Safe Fallback Response"]
    B -->|Passed| D["Generate Query Embedding"]
    D --> E["Vector Similarity Search<br/>pgvector cosine distance"]
    E --> F["Tenant Filter<br/>WHERE tenant_id = ?"]
    F --> G["Reranker<br/>Score and sort chunks"]
    G --> H["Confidence Check<br/>Threshold validation"]
    H -->|Low Confidence| I["Low Confidence Response"]
    H -->|Sufficient| J["Tenant Chunk Validation<br/>Defense-in-depth"]
    J -->|Violation| K["Cross-Tenant Block"]
    J -->|Valid| L["LLM Generation<br/>with source context"]
    L --> M["Streamed Response<br/>SSE with citations"]
```

---

## Document Processing Pipeline

When a document is uploaded, it passes through a 7-stage processing pipeline. The frontend displays real-time progress for each stage.

```mermaid
flowchart TD
    Upload["1. UPLOADING<br/>File received and stored"] --> Extract["2. EXTRACTING TEXT<br/>PDF parsed with pdf-parse"]
    Extract --> Chunk["3. CHUNKING<br/>Text split into overlapping segments<br/>512 tokens, 50-token overlap"]
    Chunk --> Embed["4. GENERATING EMBEDDINGS<br/>all-MiniLM-L6-v2<br/>384-dimensional vectors"]
    Embed --> Index["5. INDEXING VECTORS<br/>Stored in pgvector<br/>with tenant_id attached"]
    Index --> Secure["6. SECURING TENANT DATA<br/>Verify tenant isolation<br/>on every chunk"]
    Secure --> Ready["7. READY<br/>Document queryable"]

    Extract -.->|Error| Failed["FAILED<br/>Error logged, user notified"]
    Chunk -.->|Error| Failed
    Embed -.->|Error| Failed
```

---

## Query Flow

End-to-end flow from the user asking a question to receiving a cited, streamed answer.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as Fastify API
    participant Guard as Guardrails
    participant Embed as Embeddings
    participant DB as PostgreSQL + pgvector
    participant Rerank as Reranker
    participant LLM as LLM Provider

    User->>Frontend: Types question
    Frontend->>API: POST /tenant/:id/query (SSE)
    API->>Guard: Check for injection/jailbreak
    Guard-->>API: Passed / Blocked

    alt Query Blocked
        API-->>Frontend: SSE error event
        Frontend-->>User: Safe fallback message
    end

    API->>Embed: Generate query embedding
    Embed-->>API: 384-dim vector

    API->>DB: Cosine similarity search<br/>WHERE tenant_id = :tenantId
    DB-->>API: Top-K chunks with scores

    API->>Rerank: Score and filter chunks
    Rerank-->>API: Reranked results + confidence

    alt Low Confidence
        API-->>Frontend: Low confidence response
    end

    API->>LLM: Prompt with context chunks
    loop Token Streaming
        LLM-->>API: Token
        API-->>Frontend: SSE token event
        Frontend-->>User: Renders incrementally
    end

    API-->>Frontend: SSE sources event
    API-->>Frontend: SSE done event
```

---

## Multi-Tenant Isolation

Tenant isolation is enforced at every layer of the stack, not just at the database level.

```mermaid
flowchart TD
    subgraph Layer1["Layer 1: Authentication"]
        JWT["JWT contains userId"]
        RBAC["Role-based access control<br/>SUPER_ADMIN | TENANT_ADMIN | TENANT_USER | GUEST"]
    end

    subgraph Layer2["Layer 2: Middleware"]
        TM["Tenant Middleware<br/>Validates user belongs to tenant<br/>via TenantMembership table"]
    end

    subgraph Layer3["Layer 3: Data Access"]
        PQ["Every query includes<br/>WHERE tenant_id = :tenantId"]
        VC["Vector search filtered<br/>by tenant_id column"]
    end

    subgraph Layer4["Layer 4: Defense-in-Depth"]
        CV["Post-retrieval validation<br/>Verify all chunks match<br/>expected tenant_id"]
        AL["Audit logging<br/>Every action recorded<br/>with tenant context"]
    end

    JWT --> TM
    RBAC --> TM
    TM --> PQ
    TM --> VC
    PQ --> CV
    VC --> CV
    CV --> AL
```

---

## Guardrails

The system implements four categories of input protection, all checked before any LLM call is made.

```mermaid
flowchart TD
    Input["User Query Input"] --> PI["Prompt Injection Detection<br/>15 regex patterns<br/>ignore instructions, system prompt, etc."]
    Input --> JB["Jailbreak Detection<br/>8 regex patterns<br/>DAN mode, developer mode, etc."]
    Input --> CT["Cross-Tenant Probing<br/>4 regex patterns<br/>access other tenant, switch workspace"]
    Input --> LC["Low Confidence Check<br/>Post-retrieval threshold<br/>Minimum similarity score required"]

    PI -->|Detected| Block["Blocked with safe fallback<br/>Logged as threat"]
    JB -->|Detected| Block
    CT -->|Detected| Block
    LC -->|Below threshold| LowConf["Informed user: insufficient data"]

    PI -->|Clean| Pass["Proceed to retrieval"]
    JB -->|Clean| Pass
    CT -->|Clean| Pass
    LC -->|Above threshold| Generate["Proceed to generation"]
```

---

## Screenshots

### Landing Page

The public landing page presented to unauthenticated users, showcasing the system capabilities and providing sign-in and guest access options.

![Landing Page](Screenshots/1.PNG)

---

### Workspace Chat Interface

The main workspace view after authentication. Shows the sidebar with workspace selector, navigation, chat history, and the central query area with suggested queries.

![Workspace Chat Interface](Screenshots/2.PNG)

---

### Document Processing Pipeline

Real-time document processing view showing the 7-stage pipeline progress. Each stage (uploading, extracting text, chunking, embedding, indexing, securing, ready) is tracked and displayed.

![Document Processing Pipeline](Screenshots/3.PNG)

---

### Query with Cited Sources

A completed query showing the AI-generated answer with inline source citations. The sources panel displays the exact document chunks used, including confidence scores and chunk references.

![Query with Cited Sources](Screenshots/4.PNG)

---

### Incognito Mode

Privacy-first querying mode where chats are not stored, indexed, or associated with the workspace. Document retrieval still remains tenant-scoped.

![Incognito Mode](Screenshots/5.PNG)

---

### API Keys Configuration

Settings page for managing LLM provider API keys. Supports Groq (default with server key), OpenAI, Google Gemini, and Anthropic. Keys are stored encrypted at rest.

![API Keys Configuration](Screenshots/6.PNG)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js + TypeScript | Type-safe server and client code |
| **Backend Framework** | Fastify 5 | High-performance HTTP server |
| **Frontend Framework** | React 19 + TanStack Start | SSR-capable SPA with file-based routing |
| **Database** | PostgreSQL 16 + pgvector | Relational data + vector similarity search |
| **ORM** | Prisma 6 | Type-safe database access with migrations |
| **Caching** | Redis 7 | Session caching and rate limiting |
| **Embedding Model** | all-MiniLM-L6-v2 (Xenova) | Local 384-dim embeddings, no API calls needed |
| **LLM Providers** | Groq, OpenAI, Gemini, Anthropic | Configurable per-tenant LLM generation |
| **Auth** | JWT + Google OAuth + bcrypt | Multi-strategy authentication |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **Containerization** | Docker Compose | PostgreSQL + Redis infrastructure |
| **Validation** | Zod | Runtime schema validation |
| **Testing** | Vitest | Unit and integration tests |

---

## Project Structure

```
verity/
|-- backend/                          # Fastify API server
|   |-- src/
|   |   |-- api/                      # Route handlers
|   |   |   |-- auth.routes.ts        #   Authentication endpoints
|   |   |   |-- tenant.routes.ts      #   Tenant CRUD
|   |   |   |-- document.routes.ts    #   Document upload and management
|   |   |   |-- query.routes.ts       #   RAG query with SSE streaming
|   |   |   |-- chat.routes.ts        #   Chat history persistence
|   |   |   |-- search.routes.ts      #   Full-text search
|   |   |   |-- settings.routes.ts    #   Provider key management
|   |   |   |-- health.routes.ts      #   Health check
|   |   |-- services/                 # Business logic layer
|   |   |   |-- auth.service.ts       #   Login, register, Google OAuth, guest
|   |   |   |-- tenant.service.ts     #   Tenant lifecycle management
|   |   |   |-- document.service.ts   #   Upload, processing pipeline
|   |   |   |-- query.service.ts      #   Query orchestration
|   |   |   |-- chat.service.ts       #   Chat CRUD and message history
|   |   |   |-- search.service.ts     #   Document search
|   |   |   |-- settings.service.ts   #   Provider config with encryption
|   |   |   |-- audit.service.ts      #   Audit trail logging
|   |   |-- rag/                      # RAG pipeline modules
|   |   |   |-- pipeline.ts           #   Document ingestion orchestrator
|   |   |   |-- chunker.ts            #   Text chunking with overlap
|   |   |   |-- embeddings.ts         #   Vector embedding generation
|   |   |   |-- retrieval.ts          #   Tenant-scoped vector search
|   |   |   |-- reranker.ts           #   Chunk relevance scoring
|   |   |   |-- confidence.ts         #   Retrieval confidence assessment
|   |   |   |-- generator.ts          #   LLM response generation
|   |   |   |-- guardrails.ts         #   Input safety checks
|   |   |-- middleware/               # Request middleware
|   |   |   |-- auth.middleware.ts     #   JWT verification
|   |   |   |-- tenant.middleware.ts   #   Tenant membership validation
|   |   |-- auth/                     # Authentication modules
|   |   |   |-- jwt.ts                #   Token sign/verify
|   |   |   |-- google.ts             #   Google OAuth verification
|   |   |   |-- rbac.ts               #   Role-based access control
|   |   |-- tests/                    # Test suites
|   |   |   |-- auth.test.ts          #   Authentication tests
|   |   |   |-- guardrails.test.ts    #   Guardrail pattern tests
|   |   |   |-- rag-pipeline.test.ts  #   RAG pipeline tests
|   |   |   |-- rbac.test.ts          #   RBAC permission tests
|   |   |-- server.ts                 # Fastify bootstrap and startup
|   |-- prisma/
|   |   |-- schema.prisma             # Database schema with pgvector
|   |   |-- seed.ts                   # Database seeding script
|   |-- docker-compose.yml            # PostgreSQL + Redis containers
|   |-- Dockerfile                    # Backend container definition
|
|-- src/                              # React frontend (TanStack Start)
|   |-- routes/                       # File-based routing
|   |   |-- __root.tsx                #   Root layout with error boundaries
|   |   |-- index.tsx                 #   Main workspace / landing page
|   |   |-- auth.tsx                  #   Login and registration
|   |   |-- documents.tsx             #   Document management UI
|   |   |-- search.tsx                #   Search interface
|   |   |-- incognito.tsx             #   Privacy mode
|   |   |-- settings.tsx              #   Provider and account settings
|   |-- components/                   # Reusable UI components
|   |-- lib/                          # API client, store, utilities
|
|-- Screenshots/                      # Application screenshots
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose (for PostgreSQL and Redis)
- A **Groq API key** (free tier available at [console.groq.com](https://console.groq.com))

### 1. Clone the Repository

```bash
git clone https://github.com/Manwikkk/verity-ai.git
cd verity-ai
```

### 2. Start Infrastructure

```bash
cd backend
docker compose up -d
```

This starts:
- **PostgreSQL 16** with pgvector extension on port `5432`
- **Redis 7** on port `6379`

### 3. Configure Environment

```bash
# Backend environment
cp .env.example .env
```

Edit `backend/.env` and set the required values:

```env
# Database
DATABASE_URL=postgresql://verity:verity_dev@localhost:5432/verity

# Redis
REDIS_URL=redis://localhost:6379

# JWT (generate a random secret)
JWT_SECRET=your-random-64-character-secret-here

# Groq (required for LLM generation)
GROQ_API_KEY=your_groq_api_key_here

# Encryption key for API keys at rest
ENCRYPTION_KEY=change-me-32-byte-hex-key-00000000

# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=http://localhost:5174
```

### 4. Install Dependencies

```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ..
npm install
```

### 5. Set Up the Database

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data (creates default providers)
npm run db:seed
```

### 6. Start the Application

Open two terminal windows:

**Terminal 1 -- Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 -- Frontend:**
```bash
npm run dev
```

### 7. Access the Application

Open [http://localhost:5174](http://localhost:5174) in your browser.

- Click **Create account** to register a new user
- Or click **Continue without account** for guest mode
- Upload a PDF document to your workspace
- Start querying your documents

---

## API Reference

All API routes are prefixed based on their module. Authentication is required for most endpoints (JWT Bearer token).

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register with email/password |
| `POST` | `/auth/login` | Login with email/password |
| `POST` | `/auth/google` | Login with Google OAuth ID token |
| `POST` | `/auth/guest` | Create a temporary guest session |

### Tenant Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tenant` | Create a new tenant |
| `GET` | `/tenant/:id` | Get tenant details |
| `GET` | `/tenants` | List user's tenants |
| `DELETE` | `/tenant/:id` | Delete a tenant |

### Document Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tenant/:tenantId/documents` | Upload a document (multipart) |
| `GET` | `/tenant/:tenantId/documents` | List tenant documents |
| `GET` | `/tenant/:tenantId/documents/:id/status` | Get processing status |
| `DELETE` | `/tenant/:tenantId/documents/:id` | Delete a document and its chunks |

### Query (RAG)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tenant/:tenantId/query` | Query with SSE streaming response |
| `POST` | `/tenant/:tenantId/query/incognito` | Query without persistence |

**SSE Event Types:**

| Event | Data | Description |
|-------|------|-------------|
| `token` | `{ token: string }` | Incremental LLM output |
| `sources` | `{ sources: Source[], chatId?: string }` | Retrieved source documents |
| `done` | `{}` | Stream complete |
| `error` | `{ message: string }` | Error occurred |

### Chat Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tenant/:tenantId/chats` | List chats |
| `POST` | `/tenant/:tenantId/chats` | Create a chat |
| `GET` | `/tenant/:tenantId/chats/:id` | Get chat with messages |
| `PATCH` | `/tenant/:tenantId/chats/:id` | Update chat (title, pinned) |
| `DELETE` | `/tenant/:tenantId/chats/:id` | Delete a chat |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tenant/:tenantId/settings/providers` | List provider configurations |
| `PUT` | `/tenant/:tenantId/settings/providers/:id` | Update provider (API key, model) |
| `DELETE` | `/tenant/:tenantId/settings/providers/:id` | Remove provider key |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (database + Redis status) |

---

## Database Schema

The database uses PostgreSQL with the pgvector extension for vector similarity search.

```mermaid
erDiagram
    Tenant ||--o{ TenantMembership : "has members"
    Tenant ||--o{ Document : "owns documents"
    Tenant ||--o{ Chat : "contains chats"
    Tenant ||--o{ ProviderConfig : "configures providers"
    Tenant ||--o{ AuditLog : "records audit logs"
    Tenant ||--o{ QueryLog : "tracks queries"

    User ||--o{ TenantMembership : "belongs to tenants"
    User ||--o{ Chat : "creates chats"
    User ||--o{ ChatMessage : "sends messages"

    Document ||--o{ DocumentChunk : "split into chunks"
    Chat ||--o{ ChatMessage : "contains messages"

    Tenant {
        uuid id PK
        string name
        string tag
        string env
    }
    User {
        uuid id PK
        string email UK
        string name
        string password_hash
        string google_id UK
    }
    TenantMembership {
        uuid id PK
        uuid user_id FK
        uuid tenant_id FK
        enum role
    }
    Document {
        uuid id PK
        uuid tenant_id FK
        string name
        enum status
        int page_count
        int chunk_count
    }
    DocumentChunk {
        uuid id PK
        uuid document_id FK
        uuid tenant_id FK
        string content
        vector embedding
        int chunk_index
    }
    Chat {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        string title
        boolean pinned
    }
    ChatMessage {
        uuid id PK
        uuid chat_id FK
        string role
        string content
        json sources
        float confidence
    }
    ProviderConfig {
        uuid id PK
        uuid tenant_id FK
        string provider_id
        string model
        string api_key_encrypted
        boolean is_default
    }
```

---

## Testing

The project includes unit and integration tests covering guardrails, authentication, RBAC, and the RAG pipeline.

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

| Test Suite | File | What it covers |
|-----------|------|----------------|
| Authentication | `auth.test.ts` | Registration, login, token verification |
| Guardrails | `guardrails.test.ts` | Prompt injection, jailbreak, cross-tenant probing patterns |
| RAG Pipeline | `rag-pipeline.test.ts` | Chunking, embedding, retrieval, confidence scoring |
| RBAC | `rbac.test.ts` | Role permissions, tenant membership validation |

---

## Bonus Features

This implementation includes all listed bonus items from the assignment:

| Bonus Feature | Implementation |
|--------------|----------------|
| **JWT Authentication** | Full JWT auth with register, login, Google OAuth, and guest mode |
| **Redis Caching** | Redis for session management and rate limiting support |
| **Docker Setup** | `docker-compose.yml` with PostgreSQL (pgvector) and Redis |
| **Streaming Responses** | Server-Sent Events (SSE) for real-time token streaming |
| **Tests** | Vitest test suites for auth, guardrails, RAG pipeline, and RBAC |
| **Hybrid Search** | Vector similarity + reranking for improved retrieval quality |
| **RBAC** | Four roles: SUPER_ADMIN, TENANT_ADMIN, TENANT_USER, GUEST |

---

## Evaluation Criteria Coverage

| Criteria | Weight | Coverage |
|----------|--------|----------|
| **TypeScript Quality** | 15% | Strict TypeScript throughout, Zod runtime validation, Prisma type-safe queries, zero `any` in core logic |
| **API Design** | 15% | RESTful routes, consistent error responses with codes, SSE streaming, proper HTTP status codes |
| **Multi-Tenant Architecture** | 20% | 4-layer isolation (JWT, middleware, data access, defense-in-depth), tenant_id on every document and chunk, membership-based access |
| **RAG Implementation** | 20% | Full pipeline: PDF extraction, overlapping chunking, local embeddings (all-MiniLM-L6-v2), pgvector cosine search, reranking, confidence scoring, streamed LLM generation with citations |
| **Guardrails** | 15% | Prompt injection detection (15 patterns), jailbreak detection (8 patterns), cross-tenant probing (4 patterns), low-confidence fallbacks, post-retrieval tenant validation |
| **Code Structure + Documentation** | 15% | Clean layered architecture (routes/services/rag), comprehensive README with architecture diagrams, inline JSDoc comments, separate test directory |

---

## License

This project was built as an assignment submission. All rights reserved.
