import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { audit, db } from './_lib/db.js'
import { clearSessionCookie, requireSession, sessionFromRequest, setSessionCookie, signSession, type Role } from './_lib/auth.js'
import { assertSameOrigin, json, methodNotAllowed, queryString, requestIp } from './_lib/http.js'

const loginSchema = z.object({ email:z.string().email().transform(v=>v.toLowerCase()), password:z.string().min(8) })
const registerSchema = z.object({ name:z.string().min(2).max(100), email:z.string().email().transform(v=>v.toLowerCase()), phone:z.string().max(40).optional(), password:z.string().min(10).max(128), role:z.enum(['family','senior']) })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = queryString(req.query.action, 'session')
  if (req.method === 'GET' && action === 'session') {
    const user = await sessionFromRequest(req)
    return json(res, 200, { user })
  }
  if (req.method !== 'POST') return methodNotAllowed(res,['GET','POST'])
  if (!assertSameOrigin(req)) return json(res,403,{ error:'Invalid request origin' })

  if (action === 'login') {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return json(res,400,{ error:'Enter a valid email and password' })
    const ip=requestIp(req)
    const recentFailures=await db.query("SELECT COUNT(*)::int count FROM audit_logs WHERE action='auth.login_failed' AND ip_address=$1 AND created_at>NOW()-INTERVAL '15 minutes'",[ip||null])
    if(recentFailures.rows[0].count>=10)return json(res,429,{error:'Too many sign-in attempts. Please try again later.'})
    const { rows } = await db.query('SELECT id,email,password_hash,name,role,status,session_version FROM user_profiles WHERE email=$1 LIMIT 1',[parsed.data.email])
    const row = rows[0]
    const valid = row ? await bcrypt.compare(parsed.data.password,row.password_hash) : false
    if (!valid || row.status !== 'active') {
      await audit(null,'auth.login_failed','user',row?.id||null,{email:parsed.data.email},ip)
      return json(res,401,{ error:'Email or password is incorrect' })
    }
    const user = { id:row.id,email:row.email,name:row.name,role:row.role as Role,status:row.status,sessionVersion:row.session_version }
    setSessionCookie(res,await signSession(user))
    await db.query('UPDATE user_profiles SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1',[user.id])
    await audit(user.id,'auth.login','user',user.id,{},requestIp(req))
    return json(res,200,{ user })
  }

  if (action === 'register') {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return json(res,400,{ error:parsed.error.issues[0]?.message || 'Invalid registration details' })
    const exists = await db.query('SELECT 1 FROM user_profiles WHERE email=$1',[parsed.data.email])
    if (exists.rowCount) return json(res,409,{ error:'An account already exists for this email' })
    const hash = await bcrypt.hash(parsed.data.password,12)
    const { rows } = await db.query(`INSERT INTO user_profiles (email,password_hash,name,phone,role,status) VALUES ($1,$2,$3,$4,$5,'active') RETURNING id,email,name,role,status,session_version`,[parsed.data.email,hash,parsed.data.name,parsed.data.phone||null,parsed.data.role])
    const row = rows[0]
    if (parsed.data.role === 'senior') await db.query('INSERT INTO senior_profiles (user_id,display_name,created_by) VALUES ($1,$2,$1)',[row.id,row.name])
    const user = { id:row.id,email:row.email,name:row.name,role:row.role as Role,status:row.status,sessionVersion:row.session_version }
    setSessionCookie(res,await signSession(user))
    await audit(user.id,'auth.register','user',user.id,{ role:user.role },requestIp(req))
    return json(res,201,{ user })
  }

  if (action === 'logout') {
    const user = await sessionFromRequest(req)
    clearSessionCookie(res)
    if (user) await audit(user.id,'auth.logout','user',user.id,{},requestIp(req))
    return json(res,200,{ ok:true })
  }

  if (action === 'change-password') {
    const user = await requireSession(req,res); if (!user) return
    const parsed = z.object({ currentPassword:z.string().min(8), newPassword:z.string().min(10).max(128) }).safeParse(req.body)
    if (!parsed.success) return json(res,400,{ error:'New password must be at least 10 characters' })
    const { rows } = await db.query('SELECT password_hash FROM user_profiles WHERE id=$1',[user.id])
    if (!await bcrypt.compare(parsed.data.currentPassword,rows[0].password_hash)) return json(res,401,{ error:'Current password is incorrect' })
    const hash=await bcrypt.hash(parsed.data.newPassword,12)
    const updated=await db.query('UPDATE user_profiles SET password_hash=$1,session_version=session_version+1,updated_at=NOW() WHERE id=$2 RETURNING session_version',[hash,user.id])
    setSessionCookie(res,await signSession({...user,sessionVersion:updated.rows[0].session_version}))
    await audit(user.id,'auth.password_changed','user',user.id,{},requestIp(req))
    return json(res,200,{ ok:true })
  }

  if (action === 'forgot-password') {
    const parsed=z.object({ email:z.string().email().transform(v=>v.toLowerCase()) }).safeParse(req.body)
    if (parsed.success) {
      const found=await db.query('SELECT id FROM user_profiles WHERE email=$1',[parsed.data.email])
      if (found.rowCount) {
        const token=randomBytes(32).toString('hex'); const hash=createHash('sha256').update(token).digest('hex')
        await db.query("INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,NOW()+INTERVAL '30 minutes')",[found.rows[0].id,hash])
        await db.query(`INSERT INTO notifications (user_id,type,title,body,action_url) SELECT id,'security','Password reset requested',$1,'/app/users' FROM user_profiles WHERE role='admin' AND status='active'`,[`A password reset was requested for ${parsed.data.email}. Open User accounts to issue a temporary password.`])
      }
    }
    return json(res,200,{ ok:true, message:'If the account exists, an administrator can now issue a secure reset.' })
  }
  return json(res,404,{ error:'Unknown authentication action' })
}
