import { Pool } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import { required } from './env.mjs'

const pool = new Pool({ connectionString: required('DATABASE_URL') })
const adminEmail = process.env.ADMIN_EMAIL || 'admin@mitdir.de'
const adminPassword = required('ADMIN_PASSWORD')
const demoPassword = process.env.DEMO_PASSWORD || adminPassword

const accounts = [
  [adminEmail, adminPassword, 'Abraham Naveen', 'admin'],
  ['operations@mitdir.de', demoPassword, 'Sofia Keller', 'operations'],
  ['family@mitdir.de', demoPassword, 'Kristom Robert', 'family'],
  ['senior@mitdir.de', demoPassword, 'Anna Robert', 'senior'],
  ['partner@mitdir.de', demoPassword, 'Leonie Müller', 'partner'],
  ['carehome@mitdir.de', demoPassword, 'Haus am Stadtgarten', 'care_home'],
]

try {
  await pool.query('BEGIN')
  const ids = {}
  for (const [email,password,name,role] of accounts) {
    const hash = await bcrypt.hash(password, 12)
    const { rows } = await pool.query(
      `INSERT INTO user_profiles (email,password_hash,name,role,status)
       VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, status='active'
       RETURNING id`, [email,hash,name,role]
    )
    ids[role] = rows[0].id
  }

  const { rows: seniorRows } = await pool.query(
    `INSERT INTO senior_profiles (user_id,display_name,date_of_birth,address,city,postal_code,mobility,preferred_language,emergency_contact_name,emergency_contact_phone,care_notes,created_by)
     VALUES ($1,'Anna Robert','1944-03-12','Gartenstraße 18','Karlsruhe','76133','Uses a walking aid','German','Kristom Robert','+49 721 555 0182','Prefers a calm pace and minimal stairs.',$2)
     ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name
     RETURNING id`, [ids.senior,ids.family]
  )
  const seniorId = seniorRows[0].id

  const { rows: partnerRows } = await pool.query(
    `INSERT INTO support_partner_profiles (user_id,verification_status,background_check_status,right_to_work_verified,safeguarding_trained,first_aid_awareness,availability_status,languages,skills,rating,completed_jobs,service_radius_km)
     VALUES ($1,'verified','clear',TRUE,TRUE,TRUE,'available',ARRAY['German','English'],ARRAY['Medical journeys','Mobility support','Companionship'],4.92,47,25)
     ON CONFLICT (user_id) DO UPDATE SET verification_status='verified', availability_status='available'
     RETURNING id`, [ids.partner]
  )
  const partnerId = partnerRows[0].id

  const { rows: orgRows } = await pool.query(
    `INSERT INTO organizations (name,type,status,address,city,contact_email,contact_phone,billing_reference)
     SELECT 'Haus am Stadtgarten','care_home','active','Parkallee 7','Karlsruhe','carehome@mitdir.de','+49 721 555 0144','CARE-1008'
     WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name='Haus am Stadtgarten')
     RETURNING id`
  )
  const organizationId = orgRows[0]?.id || (await pool.query("SELECT id FROM organizations WHERE name='Haus am Stadtgarten' LIMIT 1")).rows[0].id
  await pool.query(`INSERT INTO organization_members (organization_id,user_id,member_role) VALUES ($1,$2,'manager') ON CONFLICT DO NOTHING`,[organizationId,ids.care_home])

  const services = [
    ['medical-journey','Medical journey','medical','Appointment accompaniment, hospital navigation and safe return.',4900,2400],
    ['mobility','Mobility support','mobility','Door-to-door accompaniment and transport coordination.',3500,2200],
    ['errands','Essential errands','errands','Pharmacy, groceries and household collections.',2900,2000],
    ['home-social','Home & social','home','Companionship and practical help at home.',3200,2200],
    ['post-discharge','Post-discharge support','medical','Coordinated journey home after hospital care.',5900,2500],
  ]
  for (const s of services) await pool.query(`INSERT INTO services (code,name,category,description,base_price_cents,hourly_rate_cents) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,active=TRUE`,s)
  const medicalService = (await pool.query("SELECT id FROM services WHERE code='medical-journey'")).rows[0].id
  const errandsService = (await pool.query("SELECT id FROM services WHERE code='errands'")).rows[0].id

  const seedBookings = [
    ['MD-28419',medicalService,'confirmed','2026-08-03T09:30:00+02:00','Gartenstraße 18, Karlsruhe','Städtisches Klinikum Karlsruhe',true,partnerId,8900],
    ['MD-27982',errandsService,'completed','2026-07-08T10:00:00+02:00','Gartenstraße 18, Karlsruhe','Apotheke am Europaplatz',false,partnerId,4200],
    ['MD-27641',medicalService,'review','2026-08-11T13:15:00+02:00','Parkallee 7, Karlsruhe','Hausarztzentrum Mitte',true,null,7600],
  ]
  for (const b of seedBookings) {
    await pool.query(
      `INSERT INTO bookings (booking_number,created_by,senior_id,organization_id,service_id,status,scheduled_at,pickup_address,destination_address,transport_required,assigned_partner_id,total_amount_cents,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Seeded demonstration booking')
       ON CONFLICT (booking_number) DO UPDATE SET status=EXCLUDED.status,scheduled_at=EXCLUDED.scheduled_at,assigned_partner_id=EXCLUDED.assigned_partner_id`,
      [b[0],ids.family,seniorId,b[0]==='MD-27641'?organizationId:null,...b.slice(1)]
    )
  }

  const booking = (await pool.query("SELECT id FROM bookings WHERE booking_number='MD-28419'")).rows[0]
  const milestones = [
    ['request','Booking confirmed','completed','2026-07-16T10:22:00+02:00'],
    ['match','Support partner assigned','completed','2026-07-16T11:05:00+02:00'],
    ['arrival','Partner arrival','pending',null],
    ['safe_return','Appointment and safe return','pending',null],
  ]
  for (const m of milestones) await pool.query(`INSERT INTO journey_milestones (booking_id,type,label,status,occurred_at,created_by) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM journey_milestones WHERE booking_id=$1 AND type=$2)`,[booking.id,...m,ids.operations])
  for (const permission of ['Enter the home','Accompany into consultation','Collect prescription','Update family']) await pool.query(`INSERT INTO consents (booking_id,senior_id,permission,granted,granted_by,expires_at) SELECT $1,$2,$3,TRUE,$4,'2026-08-04T00:00:00+02:00' WHERE NOT EXISTS (SELECT 1 FROM consents WHERE booking_id=$1 AND permission=$3)`,[booking.id,seniorId,permission,ids.senior])
  await pool.query(`UPDATE consents SET signature_name=COALESCE(signature_name,'Anna Robert'),signed_at=COALESCE(signed_at,created_at) WHERE booking_id=$1`,[booking.id])
  await pool.query(`INSERT INTO payments (booking_id,payer_id,amount_cents,status,method,provider_reference) SELECT $1,$2,8900,'authorised','SEPA Direct Debit','PAY-DEMO-28419' WHERE NOT EXISTS (SELECT 1 FROM payments WHERE booking_id=$1)`,[booking.id,ids.family])
  await pool.query(`INSERT INTO incidents (incident_number,booking_id,reported_by,severity,status,title,description,assigned_to) SELECT 'INC-1042',$1,$2,'low','investigating','Delayed transport confirmation','Transport provider confirmation arrived later than the service target.',$3 WHERE NOT EXISTS (SELECT 1 FROM incidents WHERE incident_number='INC-1042')`,[booking.id,ids.operations,ids.admin])
  await pool.query(`INSERT INTO notifications (user_id,title,body,type,action_url) SELECT $1,'Support partner confirmed','Leonie Müller is confirmed for booking MD-28419.','success','/app/bookings' WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id=$1 AND title='Support partner confirmed')`,[ids.family])
  await pool.query(`INSERT INTO app_preferences (user_id,elder_mode,font_scale,preferred_channel) VALUES ($1,TRUE,1.2,'phone') ON CONFLICT (user_id) DO NOTHING`,[ids.senior])
  await pool.query(`INSERT INTO notification_preferences (user_id,email_enabled,sms_enabled,whatsapp_enabled) VALUES ($1,TRUE,TRUE,TRUE) ON CONFLICT (user_id) DO NOTHING`,[ids.family])
  await pool.query(`INSERT INTO care_circle_members (senior_id,user_id,name,relationship,permissions,responsibilities,status,invited_by,accepted_at) SELECT $1,$2,'Kristom Robert','Son','{"view_journeys":true,"book_support":true,"manage_payments":true,"receive_updates":true,"manage_circle":true}',ARRAY['Bookings','Payments','Journey updates'],'active',$2,NOW() WHERE NOT EXISTS (SELECT 1 FROM care_circle_members WHERE senior_id=$1 AND user_id=$2)`,[seniorId,ids.family])
  await pool.query(`INSERT INTO emergency_contacts (senior_id,name,relationship,phone,email,priority) SELECT $1,'Kristom Robert','Son','+49 721 555 0182','family@mitdir.de',1 WHERE NOT EXISTS (SELECT 1 FROM emergency_contacts WHERE senior_id=$1 AND priority=1)`,[seniorId])
  await pool.query(`INSERT INTO availability_slots (partner_id,starts_at,ends_at,slot_type,recurrence_rule,service_area,notes) SELECT $1,'2026-08-03T08:00:00+02:00','2026-08-03T17:00:00+02:00','available','Weekly on Mondays','Karlsruhe central','Mobility and appointment journeys' WHERE NOT EXISTS (SELECT 1 FROM availability_slots WHERE partner_id=$1 AND starts_at='2026-08-03T08:00:00+02:00')`,[partnerId])
  await pool.query(`INSERT INTO recurring_plans (created_by,senior_id,service_id,preferred_partner_id,recurrence_rule,next_occurrence,pickup_address,duration_minutes,notes) SELECT $1,$2,$3,$4,'Weekly on Wednesday','2026-08-05T10:00:00+02:00','Gartenstraße 18, Karlsruhe',120,'Shopping and companionship' WHERE NOT EXISTS (SELECT 1 FROM recurring_plans WHERE senior_id=$2 AND recurrence_rule='Weekly on Wednesday')`,[ids.family,seniorId,errandsService,partnerId])
  await pool.query(`INSERT INTO secure_documents (uploaded_by,senior_id,booking_id,name,document_type,access_scope,expires_at) SELECT $1,$2,$3,'Appointment letter · City Clinic','appointment_letter','assigned_partner','2026-08-04T00:00:00+02:00' WHERE NOT EXISTS (SELECT 1 FROM secure_documents WHERE booking_id=$3 AND name='Appointment letter · City Clinic')`,[ids.family,seniorId,booking.id])
  await pool.query(`INSERT INTO medication_collections (booking_id,senior_id,pharmacy_name,collection_reference,authorised_collector,status,notes) SELECT $1,$2,'Apotheke am Europaplatz','RX-ANNA-0826',$3,'authorised','Collection authority recorded; no clinical instructions.' WHERE NOT EXISTS (SELECT 1 FROM medication_collections WHERE collection_reference='RX-ANNA-0826')`,[booking.id,seniorId,ids.partner])
  await pool.query(`INSERT INTO partner_documents (partner_id,document_type,verification_status,expires_at,reviewed_by,reviewed_at) SELECT $1,'Identity verification','verified','2028-07-16',$2,NOW() WHERE NOT EXISTS (SELECT 1 FROM partner_documents WHERE partner_id=$1 AND document_type='Identity verification')`,[partnerId,ids.admin])
  await pool.query(`INSERT INTO partner_shifts (partner_id,starts_at,ends_at,service_area,status,notes) SELECT $1,'2026-08-03T08:00:00+02:00','2026-08-03T16:30:00+02:00','Karlsruhe central','confirmed','Primary appointment shift' WHERE NOT EXISTS (SELECT 1 FROM partner_shifts WHERE partner_id=$1 AND starts_at='2026-08-03T08:00:00+02:00')`,[partnerId])
  await pool.query(`INSERT INTO service_areas (name,postal_codes,base_travel_fee_cents,per_km_cents) SELECT 'Karlsruhe central',ARRAY['76131','76133','76135','76137'],500,45 WHERE NOT EXISTS (SELECT 1 FROM service_areas WHERE name='Karlsruhe central')`)
  await pool.query(`INSERT INTO pricing_rules (name,service_id,rule_type,amount_cents,conditions) SELECT 'Standard mileage',NULL,'mileage',45,'{"unit":"kilometre","after_km":5}' WHERE NOT EXISTS (SELECT 1 FROM pricing_rules WHERE name='Standard mileage')`)
  await pool.query(`INSERT INTO promotions (code,description,discount_type,value,starts_at,ends_at,max_uses) VALUES ('WELCOME20','First family booking','percentage',20,'2026-07-01','2026-12-31',250) ON CONFLICT (code) DO NOTHING`)
  await pool.query(`INSERT INTO subscriptions (user_id,plan_name,interval,amount_cents,status,current_period_end) SELECT $1,'Family Circle','monthly',2900,'active','2026-08-16' WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id=$1 AND plan_name='Family Circle')`,[ids.family])
  const invoiceId = (await pool.query(`INSERT INTO invoices (invoice_number,user_id,status,subtotal_cents,vat_rate,vat_cents,total_cents,due_at,issued_at) VALUES ('INV-2026-0082',$1,'issued',7479,19,1421,8900,'2026-08-15',NOW()) ON CONFLICT (invoice_number) DO UPDATE SET status=EXCLUDED.status RETURNING id`,[ids.family])).rows[0].id
  await pool.query(`INSERT INTO invoice_items (invoice_id,booking_id,description,quantity,unit_price_cents,total_cents) SELECT $1,$2,'Medical journey and appointment accompaniment',1,8900,8900 WHERE NOT EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id=$1 AND booking_id=$2)`,[invoiceId,booking.id])
  const completedBooking=(await pool.query("SELECT id FROM bookings WHERE booking_number='MD-27982'")).rows[0].id
  await pool.query(`INSERT INTO ratings (booking_id,reviewer_id,partner_id,score,comment,would_book_again) VALUES ($1,$2,$3,5,'Calm, punctual and very reassuring.',TRUE) ON CONFLICT (booking_id) DO NOTHING`,[completedBooking,ids.family,partnerId])
  await pool.query(`INSERT INTO communication_deliveries (user_id,booking_id,channel,template,destination,provider,status,sent_at) SELECT $1,$2,'in_app','partner_confirmed','family@mitdir.de','MitDir','delivered',NOW() WHERE NOT EXISTS (SELECT 1 FROM communication_deliveries WHERE user_id=$1 AND booking_id=$2 AND template='partner_confirmed')`,[ids.family,booking.id])
  await pool.query(`INSERT INTO booking_match_candidates (booking_id,partner_id,score,explanation,factors,status) VALUES ($1,$2,96,'preferred language · currently available · continuity preference · 4.92 rating','{"verified":20,"available":20,"language":20,"skill":16,"rating":20,"continuity":20}','accepted') ON CONFLICT (booking_id,partner_id) DO NOTHING`,[booking.id,partnerId])
  await pool.query(`INSERT INTO safety_alerts (booking_id,senior_id,raised_by,alert_type,severity,status,details,acknowledged_by,acknowledged_at,resolved_at) SELECT $1,$2,$3,'overdue_journey','high','resolved','Demonstration overdue alert resolved after partner check-in.',$4,NOW(),NOW() WHERE NOT EXISTS (SELECT 1 FROM safety_alerts WHERE booking_id=$1 AND alert_type='overdue_journey')`,[booking.id,seniorId,ids.partner,ids.operations])
  let conversation=(await pool.query(`SELECT id FROM conversations WHERE booking_id=$1 AND subject='Appointment coordination' LIMIT 1`,[booking.id])).rows[0]
  if(!conversation) conversation=(await pool.query(`INSERT INTO conversations (booking_id,senior_id,subject,created_by) VALUES ($1,$2,'Appointment coordination',$3) RETURNING id`,[booking.id,seniorId,ids.family])).rows[0]
  for(const member of [ids.family,ids.partner,ids.operations]) await pool.query(`INSERT INTO conversation_members (conversation_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[conversation.id,member])
  await pool.query(`INSERT INTO messages (conversation_id,sender_id,body,original_language) SELECT $1,$2,'The appointment letter is in the secure vault. Anna prefers a calm pace and the side entrance.','en' WHERE NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id=$1)`,[conversation.id,ids.family])
  await pool.query(`INSERT INTO ai_jobs (requested_by,job_type,input,status,provider) SELECT $1,'booking_draft','{"text":"Telephone booking draft awaiting provider connection"}','waiting_for_provider','groq' WHERE NOT EXISTS (SELECT 1 FROM ai_jobs WHERE requested_by=$1 AND job_type='booking_draft')`,[ids.operations])
  await pool.query('COMMIT')
  console.log(`Seed complete. Admin: ${adminEmail}`)
} catch (error) {
  await pool.query('ROLLBACK')
  throw error
} finally {
  await pool.end()
}
