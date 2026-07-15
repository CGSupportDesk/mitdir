import type { VercelRequest,VercelResponse } from '@vercel/node'
import { db } from './_lib/db.js'

export default async function handler(_req:VercelRequest,res:VercelResponse){
  try { const result=await db.query('SELECT NOW() time'); res.status(200).json({ status:'ok',database:'connected',time:result.rows[0].time }) }
  catch { res.status(503).json({ status:'error',database:'unavailable' }) }
}
