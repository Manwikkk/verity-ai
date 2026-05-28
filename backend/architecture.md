# Verity Backend Architecture

## System Overview

Verity is a multi-tenant enterprise RAG (Retrieval-Augmented Generation) system that enables
organizations to query their document knowledge base using natural language.

## Core Architecture Principles

1. **Tenant Isolation**: Every database query includes `tenantId` filtering. No shared data paths.
2. **Defense in Depth**: Guardrails at input, retrieval, and output stages.
3. **Streaming First**: All LLM responses stream via SSE for real-time UX.
4. **Local Embeddings**: No external embedding API dependency — runs in-process.
5. **Encrypted at Rest**: API keys use AES-256-GCM encryption.

## Data Flow

```
User Query → Auth Middleware → Tenant Middleware → Guardrails
  → Embedding → Hybrid Retrieval (Vector + FTS)
  → Reranking → Confidence Scoring
  → LLM Generation (Streaming) → SSE → Frontend
```

## Database Design

- **PostgreSQL 16** with pgvector extension for vector similarity search
- **Prisma ORM** for type-safe queries
- All models carry `tenantId` for isolation
- Embedding column: `vector(384)` using all-MiniLM-L6-v2 dimensions

## Retrieval Strategy

### Hybrid Search
- **Vector Search**: pgvector cosine distance on chunk embeddings
- **Full-Text Search**: PostgreSQL `tsvector` with English dictionary
- Results merged, deduplicated, then reranked

### Reranking
- Cross-encoder model: Xenova/ms-marco-MiniLM-L-6-v2
- Graceful fallback to retrieval scores if model unavailable

## Security

- JWT-based auth with role-encoded tokens
- 4-tier RBAC: SUPER_ADMIN > TENANT_ADMIN > TENANT_USER > GUEST
- Prompt injection detection (regex + heuristics)
- Jailbreak pattern matching
- Cross-tenant access probing detection
- API key encryption with AES-256-GCM (per-key random IV)

## Caching

- Redis for query result caching (5 min TTL)
- Provider config caching (10 min TTL)
- Rate limiting counters
