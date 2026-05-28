/**
 * Seed script: populates demo tenants, users, documents, and provider configs.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Create pgvector extension and embedding column ──
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log("  ✓ pgvector extension enabled");
  } catch (err) {
    console.log("  ⚠ pgvector extension may already exist");
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(384)`,
    );
    console.log("  ✓ embedding column created");
  } catch (err) {
    console.log("  ⚠ embedding column may already exist");
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
    );
    console.log("  ✓ vector index created");
  } catch (err) {
    // IVFFlat needs enough rows — use HNSW instead for small datasets
    try {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops)`,
      );
      console.log("  ✓ HNSW vector index created");
    } catch {
      console.log("  ⚠ vector index may already exist or need data first");
    }
  }

  // ── Full-text search index ──
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING gin (to_tsvector('english', content))`,
    );
    console.log("  ✓ full-text search index created");
  } catch {
    console.log("  ⚠ FTS index may already exist");
  }

  // ── Tenants ──
  const tenants = await Promise.all([
    prisma.tenant.upsert({
      where: { id: "northwind" },
      update: {},
      create: { id: "northwind", name: "Northwind Legal", tag: "N", env: "prod" },
    }),
    prisma.tenant.upsert({
      where: { id: "atlas" },
      update: {},
      create: { id: "atlas", name: "Atlas Manufacturing", tag: "A", env: "prod" },
    }),
    prisma.tenant.upsert({
      where: { id: "verity-internal" },
      update: {},
      create: { id: "verity-internal", name: "Verity Internal", tag: "V", env: "dev" },
    }),
  ]);
  console.log(`  ✓ ${tenants.length} tenants`);

  // ── Demo user ──
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "elena.marsh@northwind.legal" },
    update: {},
    create: {
      email: "elena.marsh@northwind.legal",
      name: "Elena Marsh",
      passwordHash,
    },
  });
  console.log("  ✓ Demo user: elena.marsh@northwind.legal / password123");

  // ── Memberships ──
  for (const t of tenants) {
    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: t.id } },
      update: {},
      create: {
        userId: user.id,
        tenantId: t.id,
        role: t.id === "northwind" ? "TENANT_ADMIN" : "TENANT_USER",
      },
    });
  }
  console.log("  ✓ Memberships created");

  // ── Provider configs ──
  for (const t of tenants) {
    const providers = [
      { providerId: "groq", displayName: "Groq", model: "llama-3.3-70b-versatile", isDefault: true, hasServerKey: true, status: "connected" },
      { providerId: "gemini", displayName: "Google Gemini", model: "gemini-2.5-pro", isDefault: false, hasServerKey: false, status: "disconnected" },
      { providerId: "anthropic", displayName: "Anthropic", model: "claude-sonnet-4-20250514", isDefault: false, hasServerKey: false, status: "disconnected" },
      { providerId: "openai", displayName: "OpenAI", model: "gpt-4.1", isDefault: false, hasServerKey: false, status: "disconnected" },
    ];

    for (const p of providers) {
      await prisma.providerConfig.upsert({
        where: { tenantId_providerId: { tenantId: t.id, providerId: p.providerId } },
        update: {},
        create: { tenantId: t.id, ...p },
      });
    }
  }
  console.log("  ✓ Provider configs");

  // ── Sample documents for Northwind ──
  const sampleDocs = [
    { name: "HR Handbook v4.2.pdf", mimeType: "application/pdf", sizeBytes: 2516582, pageCount: 184, owner: "People Ops", status: "READY" as const, chunkCount: 412 },
    { name: "Vendor Master Service Agreement — Template.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 190464, pageCount: 22, owner: "Legal", status: "READY" as const, chunkCount: 87 },
    { name: "Finance Operations Manual 2026.pdf", mimeType: "application/pdf", sizeBytes: 5347737, pageCount: 312, owner: "Finance", status: "READY" as const, chunkCount: 1284 },
    { name: "GDPR Processor Obligations.pdf", mimeType: "application/pdf", sizeBytes: 421888, pageCount: 36, owner: "Compliance", status: "READY" as const, chunkCount: 142 },
    { name: "Q2 Procurement SOPs.pdf", mimeType: "application/pdf", sizeBytes: 1258291, pageCount: 64, owner: "Procurement", status: "CHUNKING" as const, chunkCount: 0 },
  ];

  for (const doc of sampleDocs) {
    const existing = await prisma.document.findFirst({
      where: { tenantId: "northwind", name: doc.name },
    });
    if (!existing) {
      const created = await prisma.document.create({
        data: { tenantId: "northwind", ...doc },
      });

      // Add sample chunks for READY docs
      if (doc.status === "READY") {
        const sampleContent = [
          "Eligible employees may carry over up to ten (10) unused vacation days into the following calendar year. Days exceeding this limit shall be forfeited unless the employee submits a written request to People Operations no later than December 15.",
          "For employees based in the European Union, regional statutory minimums apply and supersede this policy where more favorable to the employee. Carryover for managers (Level M3 and above) follows a separate executive policy.",
          "All vendors handling personal data must provide SOC 2 Type II attestations or equivalent certifications before contract execution. The procurement team is responsible for verifying compliance status.",
        ];

        for (let i = 0; i < Math.min(3, doc.chunkCount); i++) {
          await prisma.documentChunk.create({
            data: {
              documentId: created.id,
              tenantId: "northwind",
              content: sampleContent[i % sampleContent.length],
              chunkIndex: i,
              pageNumber: i + 1,
              tokenCount: Math.floor(sampleContent[i % sampleContent.length].split(" ").length / 0.75),
            },
          });
        }
      }
    }
  }
  console.log("  ✓ Sample documents and chunks");

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
