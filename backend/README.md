# Verity Backend

Multi-tenant RAG backend for the Verity enterprise document assistant.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 5
- **Database**: PostgreSQL 16 + pgvector
- **ORM**: Prisma 6
- **Cache**: Redis 7
- **LLM**: Groq (Llama 3.3 70B)
- **Embeddings**: Xenova/all-MiniLM-L6-v2 (local, 384-dim)
- **Auth**: JWT (jose) + Google OAuth + bcrypt
- **Language**: TypeScript (strict)

## Quick Start

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL (with pgvector) and Redis.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual values:
# - GROQ_API_KEY (required for LLM)
# - JWT_SECRET (change from default)
# - ENCRYPTION_KEY (change from default)
# - GOOGLE_CLIENT_ID (optional, for Google sign-in)
```

### 4. Set Up Database

```bash
npx prisma db push
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3001`.

### 6. Run Tests

```bash
npm test
```

## API Endpoints

### Auth (Public)
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/google | Google Sign-In |
| POST | /auth/register | Email/password registration |
| POST | /auth/login | Email/password login |
| POST | /auth/guest | Guest session |

### Tenants
| Method | Path | Description |
|--------|------|-------------|
| GET | /tenants | List user's tenants |
| GET | /tenant/:id | Tenant details |
| POST | /tenant | Create tenant |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| GET | /tenant/:id/documents | List documents |
| POST | /tenant/:id/documents | Upload (multipart) |
| GET | /tenant/:id/documents/:docId/status | Processing status |
| DELETE | /tenant/:id/documents/:docId | Delete |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| GET | /tenant/:id/chats | List chats |
| POST | /tenant/:id/chats | Create chat |
| GET | /tenant/:id/chats/:chatId | Get with messages |
| PATCH | /tenant/:id/chats/:chatId | Pin/rename |
| DELETE | /tenant/:id/chats/:chatId | Delete |

### Query (RAG with SSE streaming)
| Method | Path | Description |
|--------|------|-------------|
| POST | /tenant/:id/query | RAG query |
| POST | /tenant/:id/query/incognito | Ephemeral query |

### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | /tenant/:id/search?q= | Unified search |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | /tenant/:id/settings/providers | List providers |
| PUT | /tenant/:id/settings/providers/:pid | Update provider |
| DELETE | /tenant/:id/settings/providers/:pid | Remove key |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |

## Demo Credentials

- **Email**: elena.marsh@northwind.legal
- **Password**: password123

## Architecture

See [architecture.md](./architecture.md) for the full system design.
