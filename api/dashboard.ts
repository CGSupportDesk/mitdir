import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db.js'
import { requireSession } from './_lib/auth.js'
import { json, methodNotAllowed } from './_lib/http.js'

export default async function handler(req: VercelRequest,res: VercelResponse) {
  if(req.method!=='GET') return methodNotAllowed(res,['GET'])
  const user=await requireSession(req,res); if(!user) return
  if(['admin','operations'].includes(user.role)) {
    const [metrics,bookings,incidents,partners]=await Promise.all([
      db.query(`SELECT (SELECT COUNT(*) FROM bookings WHERE status IN ('requested','review'))::int AS unassigned,(SELECT COUNT(*) FROM bookings WHERE scheduled_at::date=CURRENT_DATE)::int AS today,(SELECT COUNT(*) FROM support_partner_profiles WHERE verification_status IN ('pending','review'))::int AS partner_reviews,(SELECT COUNT(*) FROM incidents WHERE status IN ('open','investigating'))::int AS open_incidents,(SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE status='paid' AND paid_at>=date_trunc('month',NOW()))::int AS revenue_cents`),
      db.query(`SELECT b.id,b.booking_number,b.status,b.scheduled_at,b.pickup_address,b.total_amount_cents,s.name service,sp.display_name senior,u.name partner FROM bookings b LEFT JOIN services s ON s.id=b.service_id LEFT JOIN senior_profiles sp ON sp.id=b.senior_id LEFT JOIN support_partner_profiles pp ON pp.id=b.assigned_partner_id LEFT JOIN user_profiles u ON u.id=pp.user_id ORDER BY b.scheduled_at DESC LIMIT 8`),
      db.query(`SELECT id,incident_number,severity,status,title,created_at FROM incidents ORDER BY created_at DESC LIMIT 6`),
      db.query(`SELECT pp.id,u.name,pp.verification_status,pp.availability_status,pp.rating,pp.completed_jobs FROM support_partner_profiles pp JOIN user_profiles u ON u.id=pp.user_id ORDER BY pp.updated_at DESC LIMIT 6`),
    ])
    return json(res,200,{ user,metrics:metrics.rows[0],bookings:bookings.rows,incidents:incidents.rows,partners:partners.rows })
  }
  if(user.role==='partner') {
    const profile=await db.query('SELECT id FROM support_partner_profiles WHERE user_id=$1',[user.id])
    const partnerId=profile.rows[0]?.id
    const [metrics,bookings]=await Promise.all([
      db.query(`SELECT COUNT(*) FILTER (WHERE b.status='completed')::int completed,COUNT(*) FILTER (WHERE b.status IN ('confirmed','in_progress'))::int upcoming,COALESCE(SUM(b.total_amount_cents) FILTER (WHERE b.status='completed'),0)::int earnings_cents FROM bookings b WHERE b.assigned_partner_id=$1`,[partnerId]),
      db.query(`SELECT b.id,b.booking_number,b.status,b.scheduled_at,b.pickup_address,b.destination_address,s.name service,sp.display_name senior FROM bookings b LEFT JOIN services s ON s.id=b.service_id LEFT JOIN senior_profiles sp ON sp.id=b.senior_id WHERE b.assigned_partner_id=$1 ORDER BY b.scheduled_at LIMIT 12`,[partnerId]),
    ])
    return json(res,200,{ user,metrics:metrics.rows[0],bookings:bookings.rows })
  }
  const condition=user.role==='senior'?'sp.user_id=$1':user.role==='care_home'?'EXISTS(SELECT 1 FROM organization_members om WHERE om.organization_id=b.organization_id AND om.user_id=$1)':'b.created_by=$1'
  const [bookings,notifications]=await Promise.all([
    db.query(`SELECT b.id,b.booking_number,b.status,b.scheduled_at,b.pickup_address,b.total_amount_cents,s.name service,sp.display_name senior,u.name partner FROM bookings b LEFT JOIN services s ON s.id=b.service_id LEFT JOIN senior_profiles sp ON sp.id=b.senior_id LEFT JOIN support_partner_profiles pp ON pp.id=b.assigned_partner_id LEFT JOIN user_profiles u ON u.id=pp.user_id WHERE ${condition} ORDER BY b.scheduled_at DESC LIMIT 12`,[user.id]),
    db.query('SELECT id,title,body,type,read_at,action_url,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8',[user.id]),
  ])
  return json(res,200,{ user,bookings:bookings.rows,notifications:notifications.rows,metrics:{ upcoming:bookings.rows.filter(b=>['requested','review','matched','confirmed','in_progress'].includes(b.status)).length,completed:bookings.rows.filter(b=>b.status==='completed').length } })
}
