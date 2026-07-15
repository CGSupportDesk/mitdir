import type { VercelRequest,VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { audit,db } from './_lib/db.js'
import { requireSession,type SessionUser } from './_lib/auth.js'
import { assertSameOrigin,json,methodNotAllowed,queryString,requestIp } from './_lib/http.js'

const adminRoles=['admin','operations'] as const
const isAdmin=(user:SessionUser)=>adminRoles.includes(user.role as typeof adminRoles[number])

async function list(module:string,user:SessionUser,req:VercelRequest){
  const bookingId=queryString(req.query.bookingId)
  switch(module){
    case 'public_requests':
      if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
      return (await db.query('SELECT id,reference,service,for_who,preferred_date,preferred_time,address,contact_name,contact_phone,contact_email,status,created_at FROM public_support_requests ORDER BY created_at DESC LIMIT 100')).rows
    case 'bookings': {
      let where='TRUE'; const params:unknown[]=[]
      if(user.role==='family'){params.push(user.id);where=`b.created_by=$${params.length}`}
      if(user.role==='senior'){params.push(user.id);where=`sp.user_id=$${params.length}`}
      if(user.role==='partner'){params.push(user.id);where=`pu.id=$${params.length}`}
      if(user.role==='care_home'){params.push(user.id);where=`EXISTS(SELECT 1 FROM organization_members om WHERE om.organization_id=b.organization_id AND om.user_id=$${params.length})`}
      return (await db.query(`SELECT b.*,s.name service,sp.display_name senior,pu.name partner,o.name organization FROM bookings b LEFT JOIN services s ON s.id=b.service_id LEFT JOIN senior_profiles sp ON sp.id=b.senior_id LEFT JOIN support_partner_profiles pp ON pp.id=b.assigned_partner_id LEFT JOIN user_profiles pu ON pu.id=pp.user_id LEFT JOIN organizations o ON o.id=b.organization_id WHERE ${where} ORDER BY b.scheduled_at DESC LIMIT 100`,params)).rows
    }
    case 'users':
      if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
      return (await db.query('SELECT id,email,name,phone,role,status,last_login_at,created_at FROM user_profiles ORDER BY created_at DESC LIMIT 100')).rows
    case 'partners':
      if(user.role==='partner') return (await db.query(`SELECT pp.*,u.name,u.email,u.phone,u.status FROM support_partner_profiles pp JOIN user_profiles u ON u.id=pp.user_id WHERE pp.user_id=$1`,[user.id])).rows
      if(!isAdmin(user) && user.role!=='care_home') throw Object.assign(new Error('Forbidden'),{status:403})
      return (await db.query(`SELECT pp.*,u.name,u.email,u.phone,u.status FROM support_partner_profiles pp JOIN user_profiles u ON u.id=pp.user_id ORDER BY pp.updated_at DESC LIMIT 100`)).rows
    case 'seniors': {
      if(user.role==='senior') return (await db.query('SELECT * FROM senior_profiles WHERE user_id=$1',[user.id])).rows
      if(user.role==='family') return (await db.query('SELECT * FROM senior_profiles WHERE created_by=$1 OR user_id IN (SELECT id FROM user_profiles WHERE email=$2)',[user.id,user.email])).rows
      if(user.role==='care_home') return (await db.query(`SELECT DISTINCT sp.* FROM senior_profiles sp JOIN bookings b ON b.senior_id=sp.id JOIN organization_members om ON om.organization_id=b.organization_id WHERE om.user_id=$1`,[user.id])).rows
      if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
      return (await db.query('SELECT sp.*,u.email,u.status FROM senior_profiles sp LEFT JOIN user_profiles u ON u.id=sp.user_id ORDER BY sp.created_at DESC LIMIT 100')).rows
    }
    case 'organizations':
      if(!isAdmin(user) && user.role!=='care_home') throw Object.assign(new Error('Forbidden'),{status:403})
      return (await db.query('SELECT o.*,(SELECT COUNT(*) FROM organization_members om WHERE om.organization_id=o.id)::int members FROM organizations o ORDER BY o.created_at DESC LIMIT 100')).rows
    case 'payments': {
      if(isAdmin(user)) return (await db.query(`SELECT p.*,b.booking_number,u.name payer FROM payments p LEFT JOIN bookings b ON b.id=p.booking_id LEFT JOIN user_profiles u ON u.id=p.payer_id ORDER BY p.created_at DESC LIMIT 100`)).rows
      return (await db.query(`SELECT p.*,b.booking_number FROM payments p JOIN bookings b ON b.id=p.booking_id LEFT JOIN senior_profiles sp ON sp.id=b.senior_id WHERE p.payer_id=$1 OR sp.user_id=$1 ORDER BY p.created_at DESC`,[user.id])).rows
    }
    case 'incidents': {
      if(isAdmin(user)) return (await db.query(`SELECT i.*,b.booking_number,u.name reporter,a.name assignee FROM incidents i LEFT JOIN bookings b ON b.id=i.booking_id LEFT JOIN user_profiles u ON u.id=i.reported_by LEFT JOIN user_profiles a ON a.id=i.assigned_to ORDER BY i.created_at DESC LIMIT 100`)).rows
      return (await db.query(`SELECT i.*,b.booking_number FROM incidents i LEFT JOIN bookings b ON b.id=i.booking_id LEFT JOIN support_partner_profiles pp ON pp.id=b.assigned_partner_id WHERE i.reported_by=$1 OR b.created_by=$1 OR pp.user_id=$1 ORDER BY i.created_at DESC`,[user.id])).rows
    }
    case 'consents': {
      const params=[user.id]
      const where=isAdmin(user)?'TRUE':`(c.granted_by=$1 OR b.created_by=$1 OR sp.user_id=$1)`
      return (await db.query(`SELECT c.*,b.booking_number,sp.display_name senior FROM consents c LEFT JOIN bookings b ON b.id=c.booking_id LEFT JOIN senior_profiles sp ON sp.id=c.senior_id WHERE ${where} ORDER BY c.created_at DESC LIMIT 100`,isAdmin(user)?[]:params)).rows
    }
    case 'services': return (await db.query('SELECT * FROM services ORDER BY category,name')).rows
    case 'audit':
      if(user.role!=='admin') throw Object.assign(new Error('Forbidden'),{status:403})
      return (await db.query(`SELECT a.*,u.name actor FROM audit_logs a LEFT JOIN user_profiles u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100`)).rows
    case 'notifications': return (await db.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[user.id])).rows
    case 'milestones':
      if(!bookingId) throw Object.assign(new Error('bookingId is required'),{status:400})
      return (await db.query('SELECT * FROM journey_milestones WHERE booking_id=$1 ORDER BY created_at',[bookingId])).rows
    case 'expenses': {
      if(isAdmin(user)) return (await db.query(`SELECT e.*,b.booking_number,u.name uploaded_by_name FROM expenses e JOIN bookings b ON b.id=e.booking_id LEFT JOIN user_profiles u ON u.id=e.uploaded_by ORDER BY e.created_at DESC`)).rows
      return (await db.query(`SELECT e.*,b.booking_number FROM expenses e JOIN bookings b ON b.id=e.booking_id LEFT JOIN support_partner_profiles pp ON pp.id=b.assigned_partner_id WHERE e.uploaded_by=$1 OR b.created_by=$1 OR pp.user_id=$1 ORDER BY e.created_at DESC`,[user.id])).rows
    }
    default: throw Object.assign(new Error('Unknown module'),{status:404})
  }
}

async function create(module:string,user:SessionUser,body:unknown){
  if(module==='bookings'){
    if(user.role==='partner') throw Object.assign(new Error('Partners cannot create bookings'),{status:403})
    const parsed=z.object({ seniorId:z.string().uuid().optional(),serviceId:z.string().uuid(),scheduledAt:z.string(),pickupAddress:z.string().min(5),destinationAddress:z.string().optional(),transportRequired:z.boolean().default(false),notes:z.string().optional(),familyUpdates:z.boolean().default(true),organizationId:z.string().uuid().optional() }).parse(body)
    let seniorId=parsed.seniorId
    if(!seniorId && user.role==='senior') seniorId=(await db.query('SELECT id FROM senior_profiles WHERE user_id=$1',[user.id])).rows[0]?.id
    if(!seniorId) throw Object.assign(new Error('A support recipient is required'),{status:400})
    const number=`MD-${Date.now().toString().slice(-6)}`
    const {rows}=await db.query(`INSERT INTO bookings (booking_number,created_by,senior_id,organization_id,service_id,scheduled_at,pickup_address,destination_address,transport_required,notes,family_updates,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'requested') RETURNING *`,[number,user.id,seniorId,parsed.organizationId||null,parsed.serviceId,parsed.scheduledAt,parsed.pickupAddress,parsed.destinationAddress||null,parsed.transportRequired,parsed.notes||null,parsed.familyUpdates])
    return rows[0]
  }
  if(module==='incidents'){
    const parsed=z.object({bookingId:z.string().uuid().optional(),severity:z.enum(['low','medium','high','critical']),title:z.string().min(3),description:z.string().min(10)}).parse(body)
    const number=`INC-${Date.now().toString().slice(-6)}`
    return (await db.query(`INSERT INTO incidents (incident_number,booking_id,reported_by,severity,title,description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[number,parsed.bookingId||null,user.id,parsed.severity,parsed.title,parsed.description])).rows[0]
  }
  if(module==='milestones'){
    if(!isAdmin(user)&&user.role!=='partner') throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({bookingId:z.string().uuid(),type:z.string(),label:z.string(),status:z.enum(['pending','active','completed','skipped','alert']),note:z.string().optional()}).parse(body)
    return (await db.query(`INSERT INTO journey_milestones (booking_id,type,label,status,occurred_at,note,created_by) VALUES ($1,$2,$3,$4,CASE WHEN $4='completed' THEN NOW() ELSE NULL END,$5,$6) RETURNING *`,[parsed.bookingId,parsed.type,parsed.label,parsed.status,parsed.note||null,user.id])).rows[0]
  }
  if(module==='expenses'){
    if(user.role!=='partner'&&!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({bookingId:z.string().uuid(),description:z.string().min(2),amountCents:z.number().int().positive(),receiptUrl:z.string().url().optional()}).parse(body)
    return (await db.query(`INSERT INTO expenses (booking_id,uploaded_by,description,amount_cents,receipt_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,[parsed.bookingId,user.id,parsed.description,parsed.amountCents,parsed.receiptUrl||null])).rows[0]
  }
  if(module==='organizations'){
    if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({name:z.string().min(2),type:z.enum(['care_home','transport','pharmacy','hospital','clinic','municipality','insurer','other']),address:z.string().optional(),city:z.string().optional(),contactEmail:z.string().email().optional()}).parse(body)
    return (await db.query(`INSERT INTO organizations (name,type,address,city,contact_email,status) VALUES ($1,$2,$3,$4,$5,'active') RETURNING *`,[parsed.name,parsed.type,parsed.address||null,parsed.city||null,parsed.contactEmail||null])).rows[0]
  }
  if(module==='users'){
    if(user.role!=='admin') throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({name:z.string().min(2),email:z.string().email(),role:z.enum(['admin','operations','family','senior','partner','care_home']),phone:z.string().optional()}).parse(body)
    const temporaryPassword=`MitDir!${randomBytes(9).toString('base64url')}`
    const hash=await bcrypt.hash(temporaryPassword,12)
    const created=(await db.query(`INSERT INTO user_profiles (email,password_hash,name,phone,role,status) VALUES (LOWER($1),$2,$3,$4,$5,'invited') RETURNING id,email,name,phone,role,status,created_at`,[parsed.email,hash,parsed.name,parsed.phone||null,parsed.role])).rows[0]
    return {...created,temporaryPassword}
  }
  throw Object.assign(new Error('Creation is not supported for this module'),{status:405})
}

async function update(module:string,user:SessionUser,body:unknown){
  const base=z.object({id:z.string().uuid()}).parse(body)
  if(module==='bookings'){
    if(!isAdmin(user)&&user.role!=='partner') throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({id:z.string().uuid(),status:z.enum(['requested','review','matched','confirmed','in_progress','completed','cancelled','incident']).optional(),assignedPartnerId:z.string().uuid().nullable().optional(),notes:z.string().optional()}).parse(body)
    if(user.role==='partner' && parsed.status && !['in_progress','completed','incident'].includes(parsed.status)) throw Object.assign(new Error('Forbidden status change'),{status:403})
    return (await db.query(`UPDATE bookings SET status=COALESCE($1,status),assigned_partner_id=COALESCE($2,assigned_partner_id),notes=COALESCE($3,notes),updated_at=NOW() WHERE id=$4 RETURNING *`,[parsed.status||null,parsed.assignedPartnerId??null,parsed.notes||null,parsed.id])).rows[0]
  }
  if(module==='partners'){
    const parsed=z.object({id:z.string().uuid(),verificationStatus:z.enum(['pending','review','verified','rejected','suspended']).optional(),availabilityStatus:z.enum(['available','busy','offline','away']).optional()}).parse(body)
    if(user.role==='partner'){
      if(parsed.verificationStatus) throw Object.assign(new Error('Partners cannot change verification status'),{status:403})
      const owns=await db.query('SELECT 1 FROM support_partner_profiles WHERE id=$1 AND user_id=$2',[parsed.id,user.id])
      if(!owns.rowCount) throw Object.assign(new Error('Forbidden'),{status:403})
    } else if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
    return (await db.query(`UPDATE support_partner_profiles SET verification_status=COALESCE($1,verification_status),availability_status=COALESCE($2,availability_status),updated_at=NOW() WHERE id=$3 RETURNING *`,[parsed.verificationStatus||null,parsed.availabilityStatus||null,parsed.id])).rows[0]
  }
  if(module==='users'){
    if(user.role!=='admin') throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({id:z.string().uuid(),status:z.enum(['active','invited','suspended','pending']).optional(),role:z.enum(['admin','operations','family','senior','partner','care_home']).optional(),resetPassword:z.boolean().optional()}).parse(body)
    if(parsed.resetPassword){
      const temporaryPassword=`MitDir!${randomBytes(9).toString('base64url')}`
      const hash=await bcrypt.hash(temporaryPassword,12)
      const changed=(await db.query(`UPDATE user_profiles SET password_hash=$1,status='active',session_version=session_version+1,updated_at=NOW() WHERE id=$2 RETURNING id,email,name,phone,role,status,updated_at`,[hash,parsed.id])).rows[0]
      return {...changed,temporaryPassword}
    }
    return (await db.query(`UPDATE user_profiles SET status=COALESCE($1,status),role=COALESCE($2,role),session_version=CASE WHEN $1='suspended' THEN session_version+1 ELSE session_version END,updated_at=NOW() WHERE id=$3 RETURNING id,email,name,phone,role,status,updated_at`,[parsed.status||null,parsed.role||null,parsed.id])).rows[0]
  }
  if(module==='incidents'){
    if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({id:z.string().uuid(),status:z.enum(['open','investigating','resolved','closed']).optional(),resolution:z.string().optional(),assignedTo:z.string().uuid().optional()}).parse(body)
    return (await db.query(`UPDATE incidents SET status=COALESCE($1,status),resolution=COALESCE($2,resolution),assigned_to=COALESCE($3,assigned_to),resolved_at=CASE WHEN $1 IN ('resolved','closed') THEN NOW() ELSE resolved_at END,updated_at=NOW() WHERE id=$4 RETURNING *`,[parsed.status||null,parsed.resolution||null,parsed.assignedTo||null,parsed.id])).rows[0]
  }
  if(module==='notifications'){
    const result=await db.query('UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *',[base.id,user.id]); return result.rows[0]
  }
  if(module==='expenses'){
    if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({id:z.string().uuid(),approvalStatus:z.enum(['pending','approved','rejected'])}).parse(body)
    return (await db.query('UPDATE expenses SET approval_status=$1 WHERE id=$2 RETURNING *',[parsed.approvalStatus,parsed.id])).rows[0]
  }
  if(module==='public_requests'){
    if(!isAdmin(user)) throw Object.assign(new Error('Forbidden'),{status:403})
    const parsed=z.object({id:z.string().uuid(),status:z.enum(['new','contacted','converted','closed'])}).parse(body)
    return (await db.query('UPDATE public_support_requests SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[parsed.status,parsed.id])).rows[0]
  }
  throw Object.assign(new Error('Update is not supported for this module'),{status:405})
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  const user=await requireSession(req,res); if(!user) return
  const module=queryString(req.query.module)
  try{
    if(req.method==='GET') return json(res,200,{items:await list(module,user,req)})
    if(!assertSameOrigin(req)) return json(res,403,{error:'Invalid request origin'})
    let item
    if(req.method==='POST') item=await create(module,user,req.body)
    else if(req.method==='PATCH') item=await update(module,user,req.body)
    else return methodNotAllowed(res,['GET','POST','PATCH'])
    if(!item) return json(res,404,{error:'Record not found'})
    await audit(user.id,`${module}.${req.method.toLowerCase()}`,module,item.id??null,{status:item.status},requestIp(req))
    return json(res,req.method==='POST'?201:200,{item})
  }catch(error){
    const status=(error as {status?:number}).status||((error as {name?:string}).name==='ZodError'?400:500)
    const message=status===500?'The request could not be completed':(error as Error).message
    return json(res,status,{error:message})
  }
}
