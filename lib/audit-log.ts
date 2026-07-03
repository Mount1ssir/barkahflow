import { dbExecute } from '@/src/lib/db'

export async function logAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeState: any | null = null,
  afterState: any | null = null,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  await dbExecute(
    `INSERT INTO audit_logs (
      id, user_id, action, entity_type, entity_id,
      before_state, after_state, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId || null,
      action,
      entityType,
      entityId || null,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      ipAddress || null,
      userAgent || null,
      now,
    ]
  )
}