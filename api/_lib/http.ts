import type { VercelRequest, VercelResponse } from '@vercel/node'

export function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body)
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '))
  json(res, 405, { error: 'Method not allowed' })
}

export function requestIp(req: VercelRequest) {
  const forwarded = req.headers['x-forwarded-for']
  return Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
}

export function assertSameOrigin(req: VercelRequest) {
  const origin = req.headers.origin
  const host = req.headers.host
  if (!origin || !host) return true
  try { return new URL(origin).host === host } catch { return false }
}

export function queryString(value: string | string[] | undefined, fallback = '') {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback
}
