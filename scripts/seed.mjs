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
  await pool.query(`INSERT INTO payments (booking_id,payer_id,amount_cents,status,method,provider_reference) SELECT $1,$2,8900,'authorised','SEPA Direct Debit','PAY-DEMO-28419' WHERE NOT EXISTS (SELECT 1 FROM payments WHERE booking_id=$1)`,[booking.id,ids.family])
  await pool.query(`INSERT INTO incidents (incident_number,booking_id,reported_by,severity,status,title,description,assigned_to) SELECT 'INC-1042',$1,$2,'low','investigating','Delayed transport confirmation','Transport provider confirmation arrived later than the service target.',$3 WHERE NOT EXISTS (SELECT 1 FROM incidents WHERE incident_number='INC-1042')`,[booking.id,ids.operations,ids.admin])
  await pool.query(`INSERT INTO notifications (user_id,title,body,type,action_url) SELECT $1,'Support partner confirmed','Leonie Müller is confirmed for booking MD-28419.','success','/app/bookings' WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id=$1 AND title='Support partner confirmed')`,[ids.family])
  await pool.query('COMMIT')
  console.log(`Seed complete. Admin: ${adminEmail}`)
} catch (error) {
  await pool.query('ROLLBACK')
  throw error
} finally {
  await pool.end()
}
