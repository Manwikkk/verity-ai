/**
 * Search service: unified search across chats, documents, and chunks.
 */
import { prisma } from "../utils/prisma.js";

export interface SearchResult {
  kind: "chat" | "doc" | "chunk";
  title: string;
  snippet: string;
  time: string;
  id: string;
  documentId?: string;
}

/** Search across chats, documents, and chunks for a tenant. */
export async function search(tenantId: string, query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const term = `%${query.trim()}%`;

  const [chatResults, docResults, chunkResults] = await Promise.all([
    // Search chats by title
    prisma.chat.findMany({
      where: { tenantId, title: { contains: query, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, title: true, updatedAt: true },
    }),

    // Search documents by name
    prisma.document.findMany({
      where: { tenantId, name: { contains: query, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, updatedAt: true, owner: true },
    }),

    // Search chunks by content
    prisma.documentChunk.findMany({
      where: { tenantId, content: { contains: query, mode: "insensitive" } },
      take: 10,
      select: {
        id: true,
        content: true,
        documentId: true,
        createdAt: true,
        document: { select: { name: true } },
      },
    }),
  ]);

  const results: SearchResult[] = [];

  for (const chat of chatResults) {
    results.push({
      kind: "chat",
      title: chat.title,
      snippet: `Chat conversation`,
      time: formatRelativeTime(chat.updatedAt),
      id: chat.id,
    });
  }

  for (const doc of docResults) {
    results.push({
      kind: "doc",
      title: doc.name,
      snippet: `Owned by ${doc.owner}`,
      time: `Indexed ${formatRelativeTime(doc.updatedAt)}`,
      id: doc.id,
    });
  }

  for (const chunk of chunkResults) {
    const start = chunk.content.toLowerCase().indexOf(query.toLowerCase());
    const snippetStart = Math.max(0, start - 30);
    const snippet = "…" + chunk.content.slice(snippetStart, snippetStart + 100) + "…";

    results.push({
      kind: "chunk",
      title: chunk.document.name,
      snippet,
      time: formatRelativeTime(chunk.createdAt),
      id: chunk.id,
      documentId: chunk.documentId,
    });
  }

  return results.slice(0, 20);
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
