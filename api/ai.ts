import type { VercelRequest,VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { audit,db } from './_lib/db.js'
import { requireSession } from './_lib/auth.js'
import { assertSameOrigin,json,methodNotAllowed,requestIp } from './_lib/http.js'

const schema=z.object({jobType:z.enum(['booking_draft','journey_summary','partner_match_explanation','incident_summary','translation','operations_forecast','voice_booking']),input:z.record(z.string(),z.unknown())})
const instructions:Record<string,string>={
  booking_draft:'Convert the supplied non-clinical support request into a concise structured booking draft. Do not diagnose or recommend medical treatment.',
  voice_booking:'Convert the supplied call transcript into a concise structured non-clinical support booking. Flag missing details.',
  journey_summary:'Summarise the journey milestones factually for an older adult and their authorised family. Do not infer medical information.',
  partner_match_explanation:'Explain the supplied deterministic partner-match factors in plain language. Do not make the assignment decision.',
  incident_summary:'Summarise the incident facts and clearly mark any urgent safeguarding details for human review. Never make an unsupervised safeguarding decision.',
  translation:'Translate the supplied message while preserving tone, names and safety-critical details.',
  operations_forecast:'Summarise supplied operational counts and identify capacity patterns. Do not invent data.',
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  const user=await requireSession(req,res);if(!user)return
  if(req.method==='GET'){
    const rows=await db.query(`SELECT * FROM ai_jobs WHERE requested_by=$1 OR $2::boolean ORDER BY created_at DESC LIMIT 50`,[user.id,['admin','operations'].includes(user.role)])
    return json(res,200,{configured:Boolean(process.env.GROQ_API_KEY),provider:'groq',model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile',items:rows.rows})
  }
  if(req.method!=='POST')return methodNotAllowed(res,['GET','POST'])
  if(!assertSameOrigin(req))return json(res,403,{error:'Invalid request origin'})
  const parsed=schema.safeParse(req.body);if(!parsed.success)return json(res,400,{error:'Invalid AI task'})
  const model=process.env.GROQ_MODEL||'llama-3.3-70b-versatile'
  const created=(await db.query(`INSERT INTO ai_jobs (requested_by,job_type,input,status,model) VALUES ($1,$2,$3,$4,$5) RETURNING *`,[user.id,parsed.data.jobType,JSON.stringify(parsed.data.input),process.env.GROQ_API_KEY?'processing':'waiting_for_provider',model])).rows[0]
  if(!process.env.GROQ_API_KEY)return json(res,202,{item:created,configured:false,message:'Groq is ready to connect. Add GROQ_API_KEY to enable this task.'})
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${process.env.GROQ_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:`You are MitDir's administrative assistant. ${instructions[parsed.data.jobType]} MitDir is non-clinical. Return concise plain text.`},{role:'user',content:JSON.stringify(parsed.data.input)}],temperature:0.2,n:1})})
    if(!response.ok)throw new Error(`Groq returned ${response.status}`)
    const result=await response.json() as {choices?:Array<{message?:{content?:string}}>}
    const text=result.choices?.[0]?.message?.content||''
    const completed=(await db.query(`UPDATE ai_jobs SET output=$1,status='completed',completed_at=NOW() WHERE id=$2 RETURNING *`,[JSON.stringify({text}),created.id])).rows[0]
    await audit(user.id,'ai.completed','ai_job',created.id,{jobType:parsed.data.jobType},requestIp(req))
    return json(res,200,{item:completed,configured:true})
  }catch(error){
    await db.query(`UPDATE ai_jobs SET status='failed',error_message=$1 WHERE id=$2`,[(error as Error).message,created.id])
    return json(res,502,{error:'The AI provider could not complete the task'})
  }
}
