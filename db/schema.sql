CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','operations','family','senior','partner','care_home')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended','pending')),
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  session_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS senior_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES user_profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  mobility TEXT,
  preferred_language TEXT DEFAULT 'German',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  care_notes TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('care_home','transport','pharmacy','hospital','clinic','municipality','insurer','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
  address TEXT,
  city TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS support_partner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','review','verified','rejected','suspended')),
  background_check_status TEXT NOT NULL DEFAULT 'pending',
  right_to_work_verified BOOLEAN NOT NULL DEFAULT FALSE,
  safeguarding_trained BOOLEAN NOT NULL DEFAULT FALSE,
  first_aid_awareness BOOLEAN NOT NULL DEFAULT FALSE,
  availability_status TEXT NOT NULL DEFAULT 'offline' CHECK (availability_status IN ('available','busy','offline','away')),
  languages TEXT[] NOT NULL DEFAULT ARRAY['German']::TEXT[],
  skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  service_radius_km INTEGER NOT NULL DEFAULT 20,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  hourly_rate_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  senior_id UUID REFERENCES senior_profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  assigned_partner_id UUID REFERENCES support_partner_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','review','matched','confirmed','in_progress','completed','cancelled','incident')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 120,
  pickup_address TEXT NOT NULL,
  destination_address TEXT,
  transport_required BOOLEAN NOT NULL DEFAULT FALSE,
  mobility_requirements TEXT,
  preferred_language TEXT DEFAULT 'German',
  notes TEXT,
  family_updates BOOLEAN NOT NULL DEFAULT TRUE,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','skipped','alert')),
  occurred_at TIMESTAMPTZ,
  note TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  senior_id UUID REFERENCES senior_profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  payer_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  method TEXT NOT NULL DEFAULT 'invoice',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorised','paid','failed','refunded','void')),
  provider_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  receipt_url TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number TEXT NOT NULL UNIQUE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution TEXT,
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  service TEXT NOT NULL,
  for_who TEXT NOT NULL,
  preferred_date DATE,
  preferred_time TIME,
  address TEXT NOT NULL,
  duration TEXT,
  mobility TEXT,
  transport TEXT,
  preferred_language TEXT,
  family_updates BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','closed')),
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_support_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS accessibility_preferences JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS notification_rules JSONB NOT NULL DEFAULT '{"arrival":true,"delays":true,"safe_home":true}'::JSONB;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS communication_needs TEXT;
ALTER TABLE support_partner_profiles ADD COLUMN IF NOT EXISTS base_postal_code TEXT;
ALTER TABLE support_partner_profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE support_partner_profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
ALTER TABLE support_partner_profiles ADD COLUMN IF NOT EXISTS onboarding_progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE support_partner_profiles ADD COLUMN IF NOT EXISTS identity_card_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parent_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_partner_id UUID REFERENCES support_partner_profiles(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS continuity_requested BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS matched_score NUMERIC(5,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS matching_explanation TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_distance_km NUMERIC(7,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mileage_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS emergency_state TEXT;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS signature_name TEXT;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS app_preferences (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  elder_mode BOOLEAN NOT NULL DEFAULT FALSE,
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  font_scale NUMERIC(3,2) NOT NULL DEFAULT 1,
  voice_guidance BOOLEAN NOT NULL DEFAULT FALSE,
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_channel TEXT NOT NULL DEFAULT 'in_app' CHECK (preferred_channel IN ('in_app','email','sms','whatsapp','phone')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES senior_profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  invited_email TEXT,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'trusted contact',
  permissions JSONB NOT NULL DEFAULT '{"view_journeys":true,"book_support":false,"manage_payments":false,"receive_updates":true,"manage_circle":false}'::JSONB,
  responsibilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','declined','removed')),
  invited_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES senior_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  notify_for TEXT[] NOT NULL DEFAULT ARRAY['sos','overdue']::TEXT[],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES support_partner_profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  slot_type TEXT NOT NULL DEFAULT 'available' CHECK (slot_type IN ('available','unavailable','holiday','reserved')),
  recurrence_rule TEXT,
  service_area TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS recurring_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  senior_id UUID NOT NULL REFERENCES senior_profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  preferred_partner_id UUID REFERENCES support_partner_profiles(id) ON DELETE SET NULL,
  recurrence_rule TEXT NOT NULL,
  next_occurrence TIMESTAMPTZ NOT NULL,
  pickup_address TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  senior_id UUID REFERENCES senior_profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','archived','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id,user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  original_language TEXT NOT NULL DEFAULT 'en',
  translated_body TEXT,
  translated_language TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  senior_id UUID REFERENCES senior_profiles(id) ON DELETE SET NULL,
  raised_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('sos','missed_arrival','overdue_journey','welfare_check','other')),
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','escalated','resolved','false_alarm')),
  details TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  acknowledged_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS secure_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  senior_id UUID REFERENCES senior_profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other',
  storage_key TEXT,
  file_url TEXT,
  mime_type TEXT,
  access_scope TEXT NOT NULL DEFAULT 'care_circle' CHECK (access_scope IN ('private','care_circle','assigned_partner','operations')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medication_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  senior_id UUID NOT NULL REFERENCES senior_profiles(id) ON DELETE CASCADE,
  pharmacy_name TEXT NOT NULL,
  collection_reference TEXT,
  authorised_collector UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','authorised','collected','delivered','cancelled')),
  notes TEXT,
  collected_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL DEFAULT 'note' CHECK (evidence_type IN ('note','photo','document','audio')),
  description TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES support_partner_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','expired')),
  expires_at DATE,
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES support_partner_profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  service_area TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled')),
  replacement_partner_id UUID REFERENCES support_partner_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  postal_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  base_travel_fee_cents INTEGER NOT NULL DEFAULT 0,
  per_km_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('base','hourly','mileage','evening','weekend','cancellation')),
  amount_cents INTEGER NOT NULL,
  percentage NUMERIC(5,2),
  conditions JSONB NOT NULL DEFAULT '{}'::JSONB,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed','percentage','credit')),
  value INTEGER NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  interval TEXT NOT NULL DEFAULT 'monthly' CHECK (interval IN ('monthly','annual')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','cancelled','past_due')),
  provider_reference TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','overdue','void')),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 19,
  vat_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  download_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(8,2) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS service_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES support_partner_profiles(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  would_book_again BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  journey_updates BOOLEAN NOT NULL DEFAULT TRUE,
  reminders BOOLEAN NOT NULL DEFAULT TRUE,
  delays BOOLEAN NOT NULL DEFAULT TRUE,
  safe_home BOOLEAN NOT NULL DEFAULT TRUE,
  marketing BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communication_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp','push','in_app')),
  template TEXT NOT NULL,
  destination TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  provider TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','skipped_unconfigured')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES support_partner_profiles(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  explanation TEXT NOT NULL,
  factors JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','offered','accepted','declined','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id,partner_id)
);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('booking_draft','journey_summary','partner_match_explanation','incident_summary','translation','operations_forecast','voice_booking')),
  input JSONB NOT NULL DEFAULT '{}'::JSONB,
  output JSONB,
  status TEXT NOT NULL DEFAULT 'waiting_for_provider' CHECK (status IN ('waiting_for_provider','queued','processing','completed','failed')),
  provider TEXT NOT NULL DEFAULT 'groq',
  model TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bookings_status_date ON bookings(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);
CREATE INDEX IF NOT EXISTS idx_bookings_senior ON bookings(senior_id);
CREATE INDEX IF NOT EXISTS idx_milestones_booking ON journey_milestones(booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_public_requests_created ON public_support_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_circle_senior ON care_circle_members(senior_id,status);
CREATE INDEX IF NOT EXISTS idx_availability_partner_time ON availability_slots(partner_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id,created_at);
CREATE INDEX IF NOT EXISTS idx_safety_status ON safety_alerts(status,severity,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_senior ON secure_documents(senior_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_plans(status,next_occurrence);
CREATE INDEX IF NOT EXISTS idx_communication_status ON communication_deliveries(status,created_at);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status,created_at DESC);
