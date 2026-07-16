import type { VercelRequest,VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { audit,db } from './_lib/db.js'
import { requireSession,type SessionUser } from './_lib/auth.js'
import { assertSameOrigin,json,methodNotAllowed,queryString,requestIp } from './_lib/http.js'

const isAdmin=(user:SessionUser)=>['admin','operations'].includes(user.role)
const forbidden=()=>Object.assign(new Error('Forbidden'),{status:403})

async function partnerId(user:SessionUser){
  return (await db.query('SELECT id FROM support_partner_profiles WHERE user_id=$1',[user.id])).rows[0]?.id as string|undefined
}

async function seniorIds(user:SessionUser){
  if(isAdmin(user))return (await db.query('SELECT id FROM senior_profiles')).rows.map(r=>r.id as string)
  if(user.role==='senior')return (await db.query('SELECT id FROM senior_profiles WHERE user_id=$1',[user.id])).rows.map(r=>r.id as string)
  if(user.role==='family')return (await db.query(`SELECT DISTINCT sp.id FROM senior_profiles sp LEFT JOIN care_circle_members cc ON cc.senior_id=sp.id AND cc.user_id=$1 AND cc.status='active' WHERE sp.created_by=$1 OR cc.user_id=$1`,[user.id])).rows.map(r=>r.id as string)
  if(user.role==='care_home')return (await db.query(`SELECT DISTINCT b.senior_id id FROM bookings b JOIN organization_members om ON om.organization_id=b.organization_id WHERE om.user_id=$1 AND b.senior_id IS NOT NULL`,[user.id])).rows.map(r=>r.id as string)
  if(user.role==='partner')return (await db.query(`SELECT DISTINCT b.senior_id id FROM bookings b JOIN support_partner_profiles pp ON pp.id=b.assigned_partner_id WHERE pp.user_id=$1 AND b.senior_id IS NOT NULL`,[user.id])).rows.map(r=>r.id as string)
  return []
}

async function canAccessBooking(user:SessionUser,bookingId:string){
  if(isAdmin(user))return true
  const result=await db.query(`SELECT 1 FROM bookings b LEFT JOIN senior_profiles sp ON sp.id=b.senior_id LEFT JOIN support_partner_profiles pp ON pp.id=b.assigned_partner_id LEFT JOIN organization_members om ON om.organization_id=b.organization_id AND om.user_id=$1 LEFT JOIN care_circle_members cc ON cc.senior_id=b.senior_id AND cc.user_id=$1 AND cc.status='active' WHERE b.id=$2 AND (b.created_by=$1 OR sp.user_id=$1 OR pp.user_id=$1 OR om.user_id=$1 OR cc.user_id=$1)`,[user.id,bookingId])
  return Boolean(result.rowCount)
}

async function list(module:string,user:SessionUser,req:VercelRequest){
  const ids=await seniorIds(user)
  const bookingId=queryString(req.query.bookingId)
  const conversationId=queryString(req.query.conversationId)
  switch(module){
    case 'care_circle':
      return (await db.query(`SELECT cc.*,sp.display_name senior,u.email account_email FROM care_circle_members cc JOIN senior_profiles sp ON sp.id=cc.senior_id LEFT JOIN user_profiles u ON u.id=cc.user_id WHERE cc.senior_id=ANY($1::uuid[]) ORDER BY cc.created_at DESC`,[ids])).rows
    case 'emergency_contacts':
      return (await db.query(`SELECT ec.*,sp.display_name senior FROM emergency_contacts ec JOIN senior_profiles sp ON sp.id=ec.senior_id WHERE ec.senior_id=ANY($1::uuid[]) ORDER BY ec.priority,ec.created_at`,[ids])).rows
    case 'availability': {
      const own=await partnerId(user)
      if(user.role==='partner')return (await db.query(`SELECT a.*,u.name partner FROM availability_slots a JOIN support_partner_profiles pp ON pp.id=a.partner_id JOIN user_profiles u ON u.id=pp.user_id WHERE a.partner_id=$1 ORDER BY a.starts_at`,[own])).rows
      return (await db.query(`SELECT a.*,u.name partner,pp.languages,pp.skills,pp.rating FROM availability_slots a JOIN support_partner_profiles pp ON pp.id=a.partner_id JOIN user_profiles u ON u.id=pp.user_id WHERE ($1::boolean OR a.slot_type='available') AND a.ends_at>NOW() ORDER BY a.starts_at LIMIT 200`,[isAdmin(user)])).rows
    }
    case 'conversations':
      return (await db.query(`SELECT c.*,b.booking_number,sp.display_name senior,(SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,(SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message_at FROM conversations c LEFT JOIN bookings b ON b.id=c.booking_id LEFT JOIN senior_profiles sp ON sp.id=c.senior_id WHERE $2::boolean OR EXISTS(SELECT 1 FROM conversation_members cm WHERE cm.conversation_id=c.id AND cm.user_id=$1) ORDER BY COALESCE((SELECT MAX(created_at) FROM messages m WHERE m.conversation_id=c.id),c.created_at) DESC`,[user.id,isAdmin(user)])).rows
    case 'messages':
      if(!conversationId)throw Object.assign(new Error('conversationId is required'),{status:400})
      if(!isAdmin(user)&&!(await db.query('SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2',[conversationId,user.id])).rowCount)throw forbidden()
      return (await db.query(`SELECT m.*,u.name sender FROM messages m LEFT JOIN user_profiles u ON u.id=m.sender_id WHERE m.conversation_id=$1 ORDER BY m.created_at`,[conversationId])).rows
    case 'safety_alerts':
      if(isAdmin(user))return (await db.query(`SELECT sa.*,b.booking_number,sp.display_name senior,u.name raised_by_name FROM safety_alerts sa LEFT JOIN bookings b ON b.id=sa.booking_id LEFT JOIN senior_profiles sp ON sp.id=sa.senior_id LEFT JOIN user_profiles u ON u.id=sa.raised_by ORDER BY CASE sa.status WHEN 'open' THEN 0 WHEN 'escalated' THEN 1 ELSE 2 END,sa.created_at DESC`)).rows
      return (await db.query(`SELECT sa.*,b.booking_number,sp.display_name senior FROM safety_alerts sa LEFT JOIN bookings b ON b.id=sa.booking_id LEFT JOIN senior_profiles sp ON sp.id=sa.senior_id WHERE sa.raised_by=$1 OR sa.senior_id=ANY($2::uuid[]) ORDER BY sa.created_at DESC`,[user.id,ids])).rows
    case 'documents':
      return (await db.query(`SELECT d.*,sp.display_name senior,b.booking_number,u.name uploaded_by_name FROM secure_documents d LEFT JOIN senior_profiles sp ON sp.id=d.senior_id LEFT JOIN bookings b ON b.id=d.booking_id LEFT JOIN user_profiles u ON u.id=d.uploaded_by WHERE $2::boolean OR d.uploaded_by=$1 OR d.senior_id=ANY($3::uuid[]) ORDER BY d.created_at DESC`,[user.id,isAdmin(user),ids])).rows
    case 'consent_records':
      return (await db.query(`SELECT c.*,b.booking_number,sp.display_name senior,CASE WHEN c.revoked_at IS NOT NULL THEN 'revoked' WHEN c.expires_at<NOW() THEN 'expired' ELSE 'active' END consent_status FROM consents c LEFT JOIN bookings b ON b.id=c.booking_id LEFT JOIN senior_profiles sp ON sp.id=c.senior_id WHERE $1::boolean OR c.senior_id=ANY($2::uuid[]) ORDER BY c.created_at DESC`,[isAdmin(user),ids])).rows
    case 'medication_collections':
      return (await db.query(`SELECT mc.*,sp.display_name senior,b.booking_number,u.name collector FROM medication_collections mc JOIN senior_profiles sp ON sp.id=mc.senior_id LEFT JOIN bookings b ON b.id=mc.booking_id LEFT JOIN user_profiles u ON u.id=mc.authorised_collector WHERE $1::boolean OR mc.senior_id=ANY($2::uuid[]) ORDER BY mc.created_at DESC`,[isAdmin(user),ids])).rows
    case 'recurring_plans':
      return (await db.query(`SELECT rp.*,sp.display_name senior,s.name service,u.name preferred_partner FROM recurring_plans rp JOIN senior_profiles sp ON sp.id=rp.senior_id JOIN services s ON s.id=rp.service_id LEFT JOIN support_partner_profiles pp ON pp.id=rp.preferred_partner_id LEFT JOIN user_profiles u ON u.id=pp.user_id WHERE $1::boolean OR rp.created_by=$2 OR rp.senior_id=ANY($3::uuid[]) ORDER BY rp.next_occurrence`,[isAdmin(user),user.id,ids])).rows
    case 'partner_documents': {
      const own=await partnerId(user)
      if(!isAdmin(user)&&user.role!=='partner')throw forbidden()
      return (await db.query(`SELECT pd.*,u.name partner FROM partner_documents pd JOIN support_partner_profiles pp ON pp.id=pd.partner_id JOIN user_profiles u ON u.id=pp.user_id WHERE $1::boolean OR pd.partner_id=$2 ORDER BY pd.created_at DESC`,[isAdmin(user),own||null])).rows
    }
    case 'shifts': {
      const own=await partnerId(user)
      if(!isAdmin(user)&&user.role!=='partner'&&user.role!=='care_home')throw forbidden()
      return (await db.query(`SELECT ps.*,u.name partner,ru.name replacement_partner FROM partner_shifts ps JOIN support_partner_profiles pp ON pp.id=ps.partner_id JOIN user_profiles u ON u.id=pp.user_id LEFT JOIN support_partner_profiles rpp ON rpp.id=ps.replacement_partner_id LEFT JOIN user_profiles ru ON ru.id=rpp.user_id WHERE $1::boolean OR ps.partner_id=$2 ORDER BY ps.starts_at`,[isAdmin(user)||user.role==='care_home',own||null])).rows
    }
    case 'service_areas': return (await db.query('SELECT * FROM service_areas WHERE active OR $1::boolean ORDER BY name',[isAdmin(user)])).rows
    case 'pricing_rules': return (await db.query(`SELECT pr.*,s.name service FROM pricing_rules pr LEFT JOIN services s ON s.id=pr.service_id WHERE pr.active OR $1::boolean ORDER BY pr.created_at DESC`,[isAdmin(user)])).rows
    case 'promotions': return (await db.query(`SELECT * FROM promotions WHERE active OR $1::boolean ORDER BY created_at DESC`,[isAdmin(user)])).rows
    case 'subscriptions':
      return (await db.query(`SELECT sub.*,u.name subscriber,o.name organization FROM subscriptions sub LEFT JOIN user_profiles u ON u.id=sub.user_id LEFT JOIN organizations o ON o.id=sub.organization_id WHERE $1::boolean OR sub.user_id=$2 OR EXISTS(SELECT 1 FROM organization_members om WHERE om.organization_id=sub.organization_id AND om.user_id=$2) ORDER BY sub.created_at DESC`,[isAdmin(user),user.id])).rows
    case 'invoices':
      return (await db.query(`SELECT i.*,u.name customer,o.name organization FROM invoices i LEFT JOIN user_profiles u ON u.id=i.user_id LEFT JOIN organizations o ON o.id=i.organization_id WHERE $1::boolean OR i.user_id=$2 OR EXISTS(SELECT 1 FROM organization_members om WHERE om.organization_id=i.organization_id AND om.user_id=$2) ORDER BY i.created_at DESC`,[isAdmin(user),user.id])).rows
    case 'ratings': {
      const own=await partnerId(user)
      return (await db.query(`SELECT r.*,b.booking_number,u.name reviewer,pu.name partner FROM ratings r JOIN bookings b ON b.id=r.booking_id LEFT JOIN user_profiles u ON u.id=r.reviewer_id LEFT JOIN support_partner_profiles pp ON pp.id=r.partner_id LEFT JOIN user_profiles pu ON pu.id=pp.user_id WHERE $1::boolean OR r.reviewer_id=$2 OR r.partner_id=$3 ORDER BY r.created_at DESC`,[isAdmin(user),user.id,own||null])).rows
    }
    case 'communications':
      return (await db.query(`SELECT cd.*,u.name recipient,b.booking_number FROM communication_deliveries cd LEFT JOIN user_profiles u ON u.id=cd.user_id LEFT JOIN bookings b ON b.id=cd.booking_id WHERE $1::boolean OR cd.user_id=$2 ORDER BY cd.created_at DESC`,[isAdmin(user),user.id])).rows
    case 'matching':
      if(!bookingId) return []
      if(!isAdmin(user)&&!(await canAccessBooking(user,bookingId)))throw forbidden()
      return (await db.query(`SELECT mc.*,u.name partner,pp.rating,pp.languages,pp.skills,pp.availability_status FROM booking_match_candidates mc JOIN support_partner_profiles pp ON pp.id=mc.partner_id JOIN user_profiles u ON u.id=pp.user_id WHERE mc.booking_id=$1 ORDER BY mc.score DESC`,[bookingId])).rows
    case 'journey':
      if(!bookingId||!(await canAccessBooking(user,bookingId)))throw forbidden()
      return (await db.query(`SELECT jm.*,u.name created_by_name FROM journey_milestones jm LEFT JOIN user_profiles u ON u.id=jm.created_by WHERE jm.booking_id=$1 ORDER BY jm.created_at`,[bookingId])).rows
    case 'preferences':
      return (await db.query('SELECT * FROM app_preferences WHERE user_id=$1',[user.id])).rows
    case 'notification_preferences':
      return (await db.query('SELECT * FROM notification_preferences WHERE user_id=$1',[user.id])).rows
    case 'integrations':
      if(!isAdmin(user))throw forbidden()
      return [{name:'Email',provider:process.env.RESEND_API_KEY?'Resend':'Not connected',configured:Boolean(process.env.RESEND_API_KEY)},{name:'SMS & WhatsApp',provider:process.env.TWILIO_AUTH_TOKEN?'Twilio':'Not connected',configured:Boolean(process.env.TWILIO_AUTH_TOKEN)},{name:'Payments',provider:process.env.STRIPE_SECRET_KEY?'Stripe':'Not connected',configured:Boolean(process.env.STRIPE_SECRET_KEY)},{name:'Secure file storage',provider:process.env.BLOB_READ_WRITE_TOKEN?'Vercel Blob':'Not connected',configured:Boolean(process.env.BLOB_READ_WRITE_TOKEN)},{name:'AI',provider:process.env.GROQ_API_KEY?'Groq':'Waiting for API key',configured:Boolean(process.env.GROQ_API_KEY)}]
    case 'reports': {
      if(!isAdmin(user))throw forbidden()
      const stats=(await db.query(`SELECT COALESCE(SUM(CASE WHEN b.status='completed' THEN b.total_amount_cents ELSE 0 END),0)::int revenue_cents,COUNT(*) FILTER (WHERE b.status='completed')::int completed,COUNT(*) FILTER (WHERE b.status='cancelled')::int cancelled,COUNT(*)::int total,(SELECT COUNT(*)::int FROM support_partner_profiles WHERE verification_status='verified') verified_partners,(SELECT COALESCE(AVG(score),0)::numeric(3,2) FROM ratings) average_rating,(SELECT COALESCE(SUM(total_cents),0)::int FROM invoices WHERE status IN ('issued','overdue')) outstanding_cents FROM bookings b`)).rows[0]
      return [{id:'revenue',label:'Completed revenue',value:stats.revenue_cents,format:'money',detail:'Across completed bookings'},{id:'utilisation',label:'Completion rate',value:stats.total?Math.round(stats.completed/stats.total*100):0,format:'percent',detail:`${stats.completed} completed journeys`},{id:'cancellations',label:'Cancellation rate',value:stats.total?Math.round(stats.cancelled/stats.total*100):0,format:'percent',detail:`${stats.cancelled} cancelled bookings`},{id:'partners',label:'Verified partners',value:stats.verified_partners,format:'number',detail:'Available workforce pool'},{id:'rating',label:'Average rating',value:stats.average_rating,format:'rating',detail:'Customer satisfaction'},{id:'outstanding',label:'Outstanding invoices',value:stats.outstanding_cents,format:'money',detail:'Issued or overdue'}]
    }
    default: throw Object.assign(new Error('Unknown platform module'),{status:404})
  }
}

async function create(module:string,user:SessionUser,body:unknown){
  if(module==='care_circle'){
    const parsed=z.object({seniorId:z.string().uuid(),name:z.string().min(2),invitedEmail:z.string().email().optional(),relationship:z.string().min(2),responsibilities:z.array(z.string()).default([]),permissions:z.record(z.string(),z.boolean()).default({})}).parse(body)
    if(!(await seniorIds(user)).includes(parsed.seniorId))throw forbidden()
    return (await db.query(`INSERT INTO care_circle_members (senior_id,invited_email,name,relationship,responsibilities,permissions,invited_by) VALUES ($1,LOWER($2),$3,$4,$5,$6,$7) RETURNING *`,[parsed.seniorId,parsed.invitedEmail||null,parsed.name,parsed.relationship,parsed.responsibilities,JSON.stringify(parsed.permissions),user.id])).rows[0]
  }
  if(module==='emergency_contacts'){
    const parsed=z.object({seniorId:z.string().uuid(),name:z.string().min(2),relationship:z.string().optional(),phone:z.string().min(5),email:z.string().email().optional(),priority:z.coerce.number().int().min(1).default(1),notifyFor:z.array(z.string()).default(['sos','overdue'])}).parse(body)
    if(!(await seniorIds(user)).includes(parsed.seniorId))throw forbidden()
    return (await db.query(`INSERT INTO emergency_contacts (senior_id,name,relationship,phone,email,priority,notify_for) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[parsed.seniorId,parsed.name,parsed.relationship||null,parsed.phone,parsed.email||null,parsed.priority,parsed.notifyFor])).rows[0]
  }
  if(module==='availability'){
    if(user.role!=='partner'&&!isAdmin(user))throw forbidden()
    const parsed=z.object({partnerId:z.string().uuid().optional(),startsAt:z.string(),endsAt:z.string(),slotType:z.enum(['available','unavailable','holiday','reserved']).default('available'),recurrenceRule:z.string().optional(),serviceArea:z.string().optional(),notes:z.string().optional()}).parse(body)
    const own=await partnerId(user);const id=isAdmin(user)?parsed.partnerId:own
    if(!id)throw Object.assign(new Error('Partner profile is required'),{status:400})
    return (await db.query(`INSERT INTO availability_slots (partner_id,starts_at,ends_at,slot_type,recurrence_rule,service_area,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[id,parsed.startsAt,parsed.endsAt,parsed.slotType,parsed.recurrenceRule||null,parsed.serviceArea||null,parsed.notes||null])).rows[0]
  }
  if(module==='conversations'){
    const parsed=z.object({bookingId:z.string().uuid().optional(),seniorId:z.string().uuid().optional(),subject:z.string().min(2),memberIds:z.array(z.string().uuid()).default([]),message:z.string().min(1).optional()}).parse(body)
    if(parsed.bookingId&&!(await canAccessBooking(user,parsed.bookingId)))throw forbidden()
    if(parsed.seniorId&&!(await seniorIds(user)).includes(parsed.seniorId))throw forbidden()
    const client=await db.connect();try{await client.query('BEGIN');const conversation=(await client.query(`INSERT INTO conversations (booking_id,senior_id,subject,created_by) VALUES ($1,$2,$3,$4) RETURNING *`,[parsed.bookingId||null,parsed.seniorId||null,parsed.subject,user.id])).rows[0];const members=[...new Set([user.id,...parsed.memberIds])];for(const member of members)await client.query('INSERT INTO conversation_members (conversation_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[conversation.id,member]);if(parsed.message)await client.query('INSERT INTO messages (conversation_id,sender_id,body) VALUES ($1,$2,$3)',[conversation.id,user.id,parsed.message]);await client.query('COMMIT');return conversation}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }
  if(module==='messages'){
    const parsed=z.object({conversationId:z.string().uuid(),body:z.string().min(1).max(5000),attachmentUrl:z.string().url().optional(),attachmentType:z.string().optional(),originalLanguage:z.string().default('en')}).parse(body)
    if(!isAdmin(user)&&!(await db.query('SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2',[parsed.conversationId,user.id])).rowCount)throw forbidden()
    return (await db.query(`INSERT INTO messages (conversation_id,sender_id,body,original_language,attachment_url,attachment_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[parsed.conversationId,user.id,parsed.body,parsed.originalLanguage,parsed.attachmentUrl||null,parsed.attachmentType||null])).rows[0]
  }
  if(module==='safety_alerts'){
    const parsed=z.object({bookingId:z.string().uuid().optional(),seniorId:z.string().uuid().optional(),alertType:z.enum(['sos','missed_arrival','overdue_journey','welfare_check','other']),severity:z.enum(['medium','high','critical']).default('high'),details:z.string().max(2000).optional(),latitude:z.coerce.number().optional(),longitude:z.coerce.number().optional()}).parse(body)
    if(parsed.bookingId&&!(await canAccessBooking(user,parsed.bookingId)))throw forbidden()
    const alert=(await db.query(`INSERT INTO safety_alerts (booking_id,senior_id,raised_by,alert_type,severity,details,latitude,longitude) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[parsed.bookingId||null,parsed.seniorId||null,user.id,parsed.alertType,parsed.severity,parsed.details||null,parsed.latitude||null,parsed.longitude||null])).rows[0]
    await db.query(`INSERT INTO notifications (user_id,type,title,body,action_url) SELECT id,'safety',$1,$2,'/app/safety' FROM user_profiles WHERE role IN ('admin','operations') AND status='active'`,[`Safety alert: ${parsed.alertType.replaceAll('_',' ')}`,parsed.details||'Immediate review requested.'])
    return alert
  }
  if(module==='documents'){
    const parsed=z.object({seniorId:z.string().uuid().optional(),bookingId:z.string().uuid().optional(),name:z.string().min(2),documentType:z.string(),fileUrl:z.string().url().optional(),mimeType:z.string().optional(),accessScope:z.enum(['private','care_circle','assigned_partner','operations']).default('care_circle'),expiresAt:z.string().optional()}).parse(body)
    if(parsed.seniorId&&!(await seniorIds(user)).includes(parsed.seniorId))throw forbidden()
    return (await db.query(`INSERT INTO secure_documents (uploaded_by,senior_id,booking_id,name,document_type,file_url,mime_type,access_scope,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[user.id,parsed.seniorId||null,parsed.bookingId||null,parsed.name,parsed.documentType,parsed.fileUrl||null,parsed.mimeType||null,parsed.accessScope,parsed.expiresAt||null])).rows[0]
  }
  if(module==='consent_records'){
    const parsed=z.object({bookingId:z.string().uuid(),seniorId:z.string().uuid(),permission:z.string().min(3),signatureName:z.string().min(2),expiresAt:z.string()}).parse(body)
    if(!(await seniorIds(user)).includes(parsed.seniorId)||!(await canAccessBooking(user,parsed.bookingId)))throw forbidden()
    return (await db.query(`INSERT INTO consents (booking_id,senior_id,permission,granted,granted_by,signature_name,signed_at,expires_at) VALUES ($1,$2,$3,TRUE,$4,$5,NOW(),$6) RETURNING *`,[parsed.bookingId,parsed.seniorId,parsed.permission,user.id,parsed.signatureName,parsed.expiresAt])).rows[0]
  }
  if(module==='medication_collections'){
    const parsed=z.object({seniorId:z.string().uuid(),bookingId:z.string().uuid().optional(),pharmacyName:z.string().min(2),collectionReference:z.string().optional(),notes:z.string().optional()}).parse(body)
    if(!(await seniorIds(user)).includes(parsed.seniorId))throw forbidden()
    return (await db.query(`INSERT INTO medication_collections (booking_id,senior_id,pharmacy_name,collection_reference,authorised_collector,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[parsed.bookingId||null,parsed.seniorId,parsed.pharmacyName,parsed.collectionReference||null,user.id,parsed.notes||null])).rows[0]
  }
  if(module==='recurring_plans'){
    const parsed=z.object({seniorId:z.string().uuid(),serviceId:z.string().uuid(),preferredPartnerId:z.string().uuid().optional(),recurrenceRule:z.string().min(3),nextOccurrence:z.string(),pickupAddress:z.string().min(5),durationMinutes:z.coerce.number().int().positive().default(120),notes:z.string().optional()}).parse(body)
    if(!(await seniorIds(user)).includes(parsed.seniorId))throw forbidden()
    return (await db.query(`INSERT INTO recurring_plans (created_by,senior_id,service_id,preferred_partner_id,recurrence_rule,next_occurrence,pickup_address,duration_minutes,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[user.id,parsed.seniorId,parsed.serviceId,parsed.preferredPartnerId||null,parsed.recurrenceRule,parsed.nextOccurrence,parsed.pickupAddress,parsed.durationMinutes,parsed.notes||null])).rows[0]
  }
  if(module==='partner_documents'){
    if(user.role!=='partner'&&!isAdmin(user))throw forbidden()
    const parsed=z.object({partnerId:z.string().uuid().optional(),documentType:z.string().min(2),fileUrl:z.string().url().optional(),expiresAt:z.string().optional()}).parse(body);const id=isAdmin(user)?parsed.partnerId:await partnerId(user);if(!id)throw forbidden()
    return (await db.query(`INSERT INTO partner_documents (partner_id,document_type,file_url,expires_at) VALUES ($1,$2,$3,$4) RETURNING *`,[id,parsed.documentType,parsed.fileUrl||null,parsed.expiresAt||null])).rows[0]
  }
  if(module==='shifts'){
    if(!isAdmin(user)&&user.role!=='partner')throw forbidden()
    const parsed=z.object({partnerId:z.string().uuid().optional(),startsAt:z.string(),endsAt:z.string(),serviceArea:z.string().optional(),notes:z.string().optional()}).parse(body);const id=isAdmin(user)?parsed.partnerId:await partnerId(user);if(!id)throw forbidden()
    return (await db.query(`INSERT INTO partner_shifts (partner_id,starts_at,ends_at,service_area,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,[id,parsed.startsAt,parsed.endsAt,parsed.serviceArea||null,parsed.notes||null])).rows[0]
  }
  if(module==='service_areas'){
    if(!isAdmin(user))throw forbidden();const parsed=z.object({name:z.string().min(2),postalCodes:z.array(z.string()).min(1),baseTravelFeeCents:z.coerce.number().int().min(0),perKmCents:z.coerce.number().int().min(0)}).parse(body)
    return (await db.query(`INSERT INTO service_areas (name,postal_codes,base_travel_fee_cents,per_km_cents) VALUES ($1,$2,$3,$4) RETURNING *`,[parsed.name,parsed.postalCodes,parsed.baseTravelFeeCents,parsed.perKmCents])).rows[0]
  }
  if(module==='pricing_rules'){
    if(!isAdmin(user))throw forbidden();const parsed=z.object({name:z.string().min(2),serviceId:z.string().uuid().optional(),ruleType:z.enum(['base','hourly','mileage','evening','weekend','cancellation']),amountCents:z.coerce.number().int(),percentage:z.coerce.number().optional(),conditions:z.record(z.string(),z.unknown()).default({})}).parse(body)
    return (await db.query(`INSERT INTO pricing_rules (name,service_id,rule_type,amount_cents,percentage,conditions) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[parsed.name,parsed.serviceId||null,parsed.ruleType,parsed.amountCents,parsed.percentage||null,JSON.stringify(parsed.conditions)])).rows[0]
  }
  if(module==='promotions'){
    if(!isAdmin(user))throw forbidden();const parsed=z.object({code:z.string().min(3),description:z.string().optional(),discountType:z.enum(['fixed','percentage','credit']),value:z.coerce.number().int().positive(),startsAt:z.string().optional(),endsAt:z.string().optional(),maxUses:z.coerce.number().int().positive().optional()}).parse(body)
    return (await db.query(`INSERT INTO promotions (code,description,discount_type,value,starts_at,ends_at,max_uses) VALUES (UPPER($1),$2,$3,$4,$5,$6,$7) RETURNING *`,[parsed.code,parsed.description||null,parsed.discountType,parsed.value,parsed.startsAt||null,parsed.endsAt||null,parsed.maxUses||null])).rows[0]
  }
  if(module==='subscriptions'){
    const parsed=z.object({planName:z.string().min(2),interval:z.enum(['monthly','annual']).default('monthly'),amountCents:z.coerce.number().int().positive(),organizationId:z.string().uuid().optional()}).parse(body)
    return (await db.query(`INSERT INTO subscriptions (user_id,organization_id,plan_name,interval,amount_cents,status) VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,[parsed.organizationId?null:user.id,parsed.organizationId||null,parsed.planName,parsed.interval,parsed.amountCents])).rows[0]
  }
  if(module==='ratings'){
    const parsed=z.object({bookingId:z.string().uuid(),partnerId:z.string().uuid(),score:z.coerce.number().int().min(1).max(5),comment:z.string().max(2000).optional(),wouldBookAgain:z.boolean().optional()}).parse(body)
    if(!(await canAccessBooking(user,parsed.bookingId)))throw forbidden()
    const rating=(await db.query(`INSERT INTO ratings (booking_id,reviewer_id,partner_id,score,comment,would_book_again) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (booking_id) DO UPDATE SET score=EXCLUDED.score,comment=EXCLUDED.comment,would_book_again=EXCLUDED.would_book_again RETURNING *`,[parsed.bookingId,user.id,parsed.partnerId,parsed.score,parsed.comment||null,parsed.wouldBookAgain??null])).rows[0]
    await db.query(`UPDATE support_partner_profiles SET rating=(SELECT COALESCE(AVG(score),0) FROM ratings WHERE partner_id=$1),updated_at=NOW() WHERE id=$1`,[parsed.partnerId]);return rating
  }
  if(module==='matching'){
    if(!isAdmin(user))throw forbidden();const parsed=z.object({bookingId:z.string().uuid()}).parse(body)
    const booking=(await db.query(`SELECT b.*,sp.preferred_language senior_language,s.category service_category FROM bookings b LEFT JOIN senior_profiles sp ON sp.id=b.senior_id LEFT JOIN services s ON s.id=b.service_id WHERE b.id=$1`,[parsed.bookingId])).rows[0];if(!booking)throw Object.assign(new Error('Booking not found'),{status:404})
    const partners=(await db.query(`SELECT pp.*,u.name FROM support_partner_profiles pp JOIN user_profiles u ON u.id=pp.user_id WHERE pp.verification_status='verified' AND u.status='active'`)).rows
    await db.query('DELETE FROM booking_match_candidates WHERE booking_id=$1',[parsed.bookingId])
    for(const partner of partners){const factors={verified:20,available:partner.availability_status==='available'?20:5,language:partner.languages.includes(booking.preferred_language||booking.senior_language)?20:5,skill:partner.skills.some((s:string)=>s.toLowerCase().includes(String(booking.service_category||'').toLowerCase()))?20:8,rating:Math.round(Number(partner.rating||0)*4)};const continuity=booking.preferred_partner_id===partner.id?20:0;const score=Math.min(100,Object.values(factors).reduce((a,b)=>a+b,0)+continuity);const explanation=[factors.language===20?'preferred language':'language review needed',factors.available===20?'currently available':'availability to confirm',continuity?'continuity preference':'new match',`${partner.rating} rating`].join(' · ');await db.query(`INSERT INTO booking_match_candidates (booking_id,partner_id,score,explanation,factors) VALUES ($1,$2,$3,$4,$5)`,[parsed.bookingId,partner.id,score,explanation,JSON.stringify({...factors,continuity})])}
    return {id:parsed.bookingId,status:'suggestions_created'}
  }
  if(module==='journey'){
    if(!['partner','admin','operations'].includes(user.role))throw forbidden();const parsed=z.object({bookingId:z.string().uuid(),event:z.enum(['en_route','arrived','appointment_started','returning_home','safe_home','check_in','check_out']),note:z.string().optional()}).parse(body);if(!(await canAccessBooking(user,parsed.bookingId)))throw forbidden()
    const labels:Record<string,string>={en_route:'Partner en route',arrived:'Partner arrived',appointment_started:'Appointment started',returning_home:'Returning home',safe_home:'Safely home',check_in:'Partner checked in',check_out:'Partner checked out'}
    const item=(await db.query(`INSERT INTO journey_milestones (booking_id,type,label,status,occurred_at,note,created_by) VALUES ($1,$2,$3,'completed',NOW(),$4,$5) RETURNING *`,[parsed.bookingId,parsed.event,labels[parsed.event],parsed.note||null,user.id])).rows[0]
    if(parsed.event==='check_in')await db.query(`UPDATE bookings SET checked_in_at=NOW(),status='in_progress',updated_at=NOW() WHERE id=$1`,[parsed.bookingId]);if(parsed.event==='check_out'||parsed.event==='safe_home')await db.query(`UPDATE bookings SET checked_out_at=CASE WHEN $2='check_out' THEN NOW() ELSE checked_out_at END,status=CASE WHEN $2='safe_home' THEN 'completed' ELSE status END,updated_at=NOW() WHERE id=$1`,[parsed.bookingId,parsed.event])
    const recipients=await db.query(`SELECT DISTINCT user_id FROM care_circle_members cc JOIN bookings b ON b.senior_id=cc.senior_id WHERE b.id=$1 AND cc.status='active' AND (cc.permissions->>'receive_updates')::boolean IS TRUE UNION SELECT created_by user_id FROM bookings WHERE id=$1`,[parsed.bookingId]);for(const recipient of recipients.rows.filter(r=>r.user_id)){await db.query(`INSERT INTO notifications (user_id,title,body,type,action_url) VALUES ($1,$2,$3,'journey','/app/journeys')`,[recipient.user_id,labels[parsed.event],parsed.note||'The journey has been updated.']);await db.query(`INSERT INTO communication_deliveries (user_id,booking_id,channel,template,status) VALUES ($1,$2,'in_app',$3,'delivered')`,[recipient.user_id,parsed.bookingId,parsed.event])}
    return item
  }
  if(module==='preferences'){
    const parsed=z.object({elderMode:z.boolean().default(false),highContrast:z.boolean().default(false),fontScale:z.coerce.number().min(1).max(1.5).default(1),voiceGuidance:z.boolean().default(false),reducedMotion:z.boolean().default(false),preferredChannel:z.enum(['in_app','email','sms','whatsapp','phone']).default('in_app')}).parse(body)
    return (await db.query(`INSERT INTO app_preferences (user_id,elder_mode,high_contrast,font_scale,voice_guidance,reduced_motion,preferred_channel) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO UPDATE SET elder_mode=EXCLUDED.elder_mode,high_contrast=EXCLUDED.high_contrast,font_scale=EXCLUDED.font_scale,voice_guidance=EXCLUDED.voice_guidance,reduced_motion=EXCLUDED.reduced_motion,preferred_channel=EXCLUDED.preferred_channel,updated_at=NOW() RETURNING *`,[user.id,parsed.elderMode,parsed.highContrast,parsed.fontScale,parsed.voiceGuidance,parsed.reducedMotion,parsed.preferredChannel])).rows[0]
  }
  if(module==='notification_preferences'){
    const parsed=z.object({emailEnabled:z.boolean(),smsEnabled:z.boolean(),whatsappEnabled:z.boolean(),journeyUpdates:z.boolean(),reminders:z.boolean(),delays:z.boolean(),safeHome:z.boolean(),marketing:z.boolean()}).parse(body)
    return (await db.query(`INSERT INTO notification_preferences (user_id,email_enabled,sms_enabled,whatsapp_enabled,journey_updates,reminders,delays,safe_home,marketing) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id) DO UPDATE SET email_enabled=EXCLUDED.email_enabled,sms_enabled=EXCLUDED.sms_enabled,whatsapp_enabled=EXCLUDED.whatsapp_enabled,journey_updates=EXCLUDED.journey_updates,reminders=EXCLUDED.reminders,delays=EXCLUDED.delays,safe_home=EXCLUDED.safe_home,marketing=EXCLUDED.marketing,updated_at=NOW() RETURNING *`,[user.id,parsed.emailEnabled,parsed.smsEnabled,parsed.whatsappEnabled,parsed.journeyUpdates,parsed.reminders,parsed.delays,parsed.safeHome,parsed.marketing])).rows[0]
  }
  throw Object.assign(new Error('Creation is not supported for this module'),{status:405})
}

async function update(module:string,user:SessionUser,body:unknown){
  const parsed=z.object({id:z.string().uuid(),status:z.string().optional(),active:z.boolean().optional(),replacementPartnerId:z.string().uuid().optional(),verificationStatus:z.string().optional()}).parse(body)
  if(module==='consent_records'){
    if(parsed.status!=='revoked')throw Object.assign(new Error('Only revocation is supported'),{status:400})
    const item=(await db.query(`UPDATE consents SET granted=FALSE,revoked_at=NOW() WHERE id=$1 AND ($2::boolean OR granted_by=$3) RETURNING *`,[parsed.id,isAdmin(user),user.id])).rows[0];if(!item)throw forbidden();return item
  }
  if(module==='safety_alerts'){
    if(!isAdmin(user))throw forbidden();const status=z.enum(['open','acknowledged','escalated','resolved','false_alarm']).parse(parsed.status)
    return (await db.query(`UPDATE safety_alerts SET status=$1,acknowledged_by=CASE WHEN $1 IN ('acknowledged','escalated','resolved') THEN $2 ELSE acknowledged_by END,acknowledged_at=CASE WHEN $1 IN ('acknowledged','escalated','resolved') THEN NOW() ELSE acknowledged_at END,resolved_at=CASE WHEN $1 IN ('resolved','false_alarm') THEN NOW() ELSE resolved_at END,updated_at=NOW() WHERE id=$3 RETURNING *`,[status,user.id,parsed.id])).rows[0]
  }
  if(module==='recurring_plans'){
    const status=z.enum(['active','paused','completed','cancelled']).parse(parsed.status);const item=(await db.query(`UPDATE recurring_plans SET status=$1,updated_at=NOW() WHERE id=$2 AND ($3::boolean OR created_by=$4) RETURNING *`,[status,parsed.id,isAdmin(user),user.id])).rows[0];if(!item)throw forbidden();return item
  }
  if(module==='partner_documents'){
    if(!isAdmin(user))throw forbidden();const status=z.enum(['pending','verified','rejected','expired']).parse(parsed.verificationStatus)
    return (await db.query(`UPDATE partner_documents SET verification_status=$1,reviewed_by=$2,reviewed_at=NOW() WHERE id=$3 RETURNING *`,[status,user.id,parsed.id])).rows[0]
  }
  if(module==='shifts'){
    if(!isAdmin(user))throw forbidden();const status=z.enum(['scheduled','confirmed','in_progress','completed','cancelled']).parse(parsed.status)
    return (await db.query(`UPDATE partner_shifts SET status=$1,replacement_partner_id=COALESCE($2,replacement_partner_id) WHERE id=$3 RETURNING *`,[status,parsed.replacementPartnerId||null,parsed.id])).rows[0]
  }
  if(module==='pricing_rules'||module==='promotions'){
    if(!isAdmin(user))throw forbidden();const table=module==='pricing_rules'?'pricing_rules':'promotions'
    return (await db.query(`UPDATE ${table} SET active=$1 WHERE id=$2 RETURNING *`,[parsed.active??true,parsed.id])).rows[0]
  }
  if(module==='subscriptions'){
    const status=z.enum(['pending','active','paused','cancelled','past_due']).parse(parsed.status);if(!isAdmin(user)&&!['paused','cancelled'].includes(status))throw forbidden()
    return (await db.query(`UPDATE subscriptions SET status=$1,updated_at=NOW() WHERE id=$2 AND ($3::boolean OR user_id=$4) RETURNING *`,[status,parsed.id,isAdmin(user),user.id])).rows[0]
  }
  if(module==='medication_collections'){
    const status=z.enum(['requested','authorised','collected','delivered','cancelled']).parse(parsed.status)
    return (await db.query(`UPDATE medication_collections SET status=$1,collected_at=CASE WHEN $1='collected' THEN NOW() ELSE collected_at END,delivered_at=CASE WHEN $1='delivered' THEN NOW() ELSE delivered_at END WHERE id=$2 RETURNING *`,[status,parsed.id])).rows[0]
  }
  throw Object.assign(new Error('Update is not supported for this module'),{status:405})
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  const user=await requireSession(req,res);if(!user)return
  const module=queryString(req.query.module)
  try{
    if(req.method==='GET')return json(res,200,{items:await list(module,user,req)})
    if(!assertSameOrigin(req))return json(res,403,{error:'Invalid request origin'})
    const item=req.method==='POST'?await create(module,user,req.body):req.method==='PATCH'?await update(module,user,req.body):null
    if(!item)return methodNotAllowed(res,['GET','POST','PATCH'])
    const method=req.method||'UNKNOWN'
    await audit(user.id,`platform.${module}.${method.toLowerCase()}`,module,(item as {id?:string}).id||null,{},requestIp(req))
    return json(res,req.method==='POST'?201:200,{item})
  }catch(error){
    const status=(error as {status?:number}).status||((error as {name?:string}).name==='ZodError'?400:500)
    return json(res,status,{error:status===500?'The request could not be completed':(error as Error).message})
  }
}
