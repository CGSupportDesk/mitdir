import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { db } from './_lib/db.js'
import { assertSameOrigin,json,methodNotAllowed,requestIp } from './_lib/http.js'

const schema=z.object({service:z.string().min(2),forWho:z.string().min(2),date:z.string().optional(),time:z.string().optional(),address:z.string().min(5),duration:z.string().optional(),mobility:z.string().optional(),transport:z.string().optional(),language:z.string().optional(),familyUpdates:z.boolean().default(true),notes:z.string().max(2000).optional(),name:z.string().min(2),phone:z.string().min(5),email:z.string().email().optional().or(z.literal('')),website:z.string().optional()})

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return methodNotAllowed(res,['POST'])
  if(!assertSameOrigin(req))return json(res,403,{error:'Invalid request origin'})
  const parsed=schema.safeParse(req.body);if(!parsed.success)return json(res,400,{error:'Please complete the required booking details'})
  if(parsed.data.website)return json(res,201,{reference:'REQ-RECEIVED'})
  const ipHash=createHash('sha256').update(`${process.env.AUTH_SECRET}:${requestIp(req)}`).digest('hex')
  const recent=await db.query("SELECT COUNT(*)::int count FROM public_support_requests WHERE ip_hash=$1 AND created_at>NOW()-INTERVAL '1 hour'",[ipHash])
  if(recent.rows[0].count>=10)return json(res,429,{error:'Too many requests. Please call our concierge.'})
  const reference=`REQ-${Date.now().toString().slice(-7)}`
  await db.query(`INSERT INTO public_support_requests (reference,service,for_who,preferred_date,preferred_time,address,duration,mobility,transport,preferred_language,family_updates,notes,contact_name,contact_phone,contact_email,ip_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,[reference,parsed.data.service,parsed.data.forWho,parsed.data.date||null,parsed.data.time||null,parsed.data.address,parsed.data.duration||null,parsed.data.mobility||null,parsed.data.transport||null,parsed.data.language||null,parsed.data.familyUpdates,parsed.data.notes||null,parsed.data.name,parsed.data.phone,parsed.data.email||null,ipHash])
  return json(res,201,{reference})
}
