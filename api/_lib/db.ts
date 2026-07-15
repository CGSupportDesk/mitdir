import { Pool } from '@neondatabase/serverless'

declare global {
  var __mitdirPool: Pool | undefined
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not configured')

export const db = globalThis.__mitdirPool ?? new Pool({ connectionString })
if (process.env.NODE_ENV !== 'production') globalThis.__mitdirPool = db

export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}, ipAddress?: string) {
  await db.query(
    'INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,metadata,ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
    [actorId, action, entityType, entityId, JSON.stringify(metadata), ipAddress ?? null],
  )
}
