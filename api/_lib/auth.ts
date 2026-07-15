import type { VercelRequest, VercelResponse } from '@vercel/node'
import { jwtVerify, SignJWT } from 'jose'
import { db } from './db.js'

export type Role = 'admin' | 'operations' | 'family' | 'senior' | 'partner' | 'care_home'
export type SessionUser = { id: string; email: string; name: string; role: Role; status: string; sessionVersion: number }

const COOKIE = 'mitdir_session'
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || '')
if (secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters')

function parseCookie(header?: string) {
  if (!header) return new Map<string,string>()
  return new Map(header.split(';').map(part => {
    const index = part.indexOf('=')
    return [decodeURIComponent(part.slice(0,index).trim()), decodeURIComponent(part.slice(index + 1))]
  }))
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ email:user.email, name:user.name, role:user.role, version:user.sessionVersion })
    .setProtectedHeader({ alg:'HS256', typ:'JWT' }).setSubject(user.id).setIssuer('mitdir').setAudience('mitdir-web')
    .setIssuedAt().setExpirationTime('7d').sign(secret)
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const secure = process.env.VERCEL === '1' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`)
}

export function clearSessionCookie(res: VercelResponse) {
  const secure = process.env.VERCEL === '1' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
}

export async function sessionFromRequest(req: VercelRequest): Promise<SessionUser | null> {
  const cookieToken = parseCookie(req.headers.cookie).get(COOKIE)
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined
  const token = cookieToken || bearer
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, { issuer:'mitdir', audience:'mitdir-web' })
    const { rows } = await db.query('SELECT id,email,name,role,status,session_version FROM user_profiles WHERE id=$1 LIMIT 1',[payload.sub])
    const user = rows[0]
    if (!user || user.status !== 'active' || user.session_version !== payload.version) return null
    return { id:user.id, email:user.email, name:user.name, role:user.role, status:user.status, sessionVersion:user.session_version }
  } catch { return null }
}

export async function requireSession(req: VercelRequest, res: VercelResponse, roles?: Role[]) {
  const user = await sessionFromRequest(req)
  if (!user) { res.status(401).json({ error:'Authentication required' }); return null }
  if (roles && !roles.includes(user.role)) { res.status(403).json({ error:'You do not have permission for this action' }); return null }
  return user
}
