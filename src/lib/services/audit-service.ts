import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface CreateAuditLogParams {
  editionId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Persists an immutable audit log entry for any critical state or configuration mutation.
 */
export async function recordAuditLog(
  params: CreateAuditLogParams,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  try {
    return await client.auditLog.create({
      data: {
        editionId: params.editionId,
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousState: params.previousState ? JSON.stringify(params.previousState) : null,
        newState: params.newState ? JSON.stringify(params.newState) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to record audit log:", error);
    return null;
  }
}

/**
 * Retrieves audit logs for an edition with actor metadata.
 */
export async function getAuditLogs(editionId?: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: editionId ? { editionId } : undefined,
    include: {
      actor: {
        select: { id: true, name: true, email: true },
      },
      edition: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
