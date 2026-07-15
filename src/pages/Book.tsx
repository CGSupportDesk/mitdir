import { ArrowLeft, ArrowRight, Calendar, Check, Clock, HeartHandshake, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'

type Booking = {
  service: string
  forWho: string
  date: string
  time: string
  address: string
  duration: string
  mobility: string
  transport: string
  language: string
  familyUpdates: boolean
  notes: string
  name: string
  phone: string
  email: string
}

const initial: Booking = { service: '', forWho: 'A parent or loved one', date: '', time: '', address: '', duration: '2-3 hours', mobility: 'No mobility support needed', transport: 'Please coordinate transport', language: 'German', familyUpdates: true, notes: '', name: '', phone: '', email: '' }

const services = [
  ['Medical journey', 'Appointment accompaniment, navigation and safe return'],
  ['Mobility support', 'Door-to-door accompaniment and transport coordination'],
  ['Essential errands', 'Pharmacy, groceries or household collections'],
  ['Home & social', 'Companionship and practical help at home'],
  ['Post-discharge support', 'A coordinated journey home after hospital care'],
  ['I am not sure yet', 'Our concierge will help define the right support'],
]

export default function Book() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Booking>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const update = <K extends keyof Booking>(key: K, value: Booking[K]) => setForm(v => ({ ...v, [key]: value }))
  const canContinue = useMemo(() => step === 1 ? !!form.service : step === 2 ? !!form.date && !!form.time && !!form.address : step === 3 ? true : !!form.name && !!form.phone, [form, step])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canContinue) return
    setBusy(true);setError('')
    try {
      const response=await fetch('/api/public-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||'Could not send the request')
      navigate(`/request-confirmed?ref=${encodeURIComponent(result.reference)}`)
    } catch(err){setError((err as Error).message)} finally{setBusy(false)}
  }

  return (
    <div className="app-shell">
      <Header compact />
      <main className="booking-page">
        <div className="container booking-page__top"><Link to="/" className="back-link"><ArrowLeft /> Back to home</Link><div className="booking-help"><Phone /> Prefer to speak? <a href="tel:+497211234567">Call our concierge</a></div></div>
        <div className="container booking-layout">
          <aside className="booking-aside">
            <div className="eyebrow eyebrow--light">Book support</div>
            <h1>Let’s make the day easier.</h1>
            <p>Tell us what you need. A MitDir coordinator will review every request before confirming your support partner.</p>
            <div className="booking-assurances"><span><ShieldCheck /> No payment taken today</span><span><HeartHandshake /> Reviewed by a real person</span><span><Clock /> Usually confirmed within 2 hours</span></div>
            <div className="booking-aside__quote">“One booking, every detail covered.”</div>
          </aside>
          <section className="booking-card">
            <div className="progress"><div className="progress__labels"><span>Step {step} of 4</span><span>{['Choose support', 'Time & place', 'Preferences', 'Your details'][step - 1]}</span></div><div className="progress__bar"><span style={{ width: `${step * 25}%` }} /></div></div>
            <form onSubmit={submit}>
              {step === 1 && <div className="form-step"><div className="form-heading"><span className="form-heading__icon"><HeartHandshake /></span><div><h2>What can we help with?</h2><p>Choose the closest option. You can add details later.</p></div></div><div className="service-options">{services.map(([title, text]) => <button className={`select-card ${form.service === title ? 'select-card--active' : ''}`} type="button" key={title} onClick={() => update('service', title)}><span><strong>{title}</strong><small>{text}</small></span>{form.service === title && <Check />}</button>)}</div><label className="field"><span>Who is this support for?</span><select value={form.forWho} onChange={e => update('forWho', e.target.value)}><option>A parent or loved one</option><option>Myself</option><option>A resident or client</option></select></label></div>}

              {step === 2 && <div className="form-step"><div className="form-heading"><span className="form-heading__icon"><Calendar /></span><div><h2>When and where?</h2><p>An approximate time is fine. We will confirm the details with you.</p></div></div><div className="field-grid"><label className="field"><span>Preferred date *</span><input required type="date" value={form.date} onChange={e => update('date', e.target.value)} /></label><label className="field"><span>Preferred start time *</span><input required type="time" value={form.time} onChange={e => update('time', e.target.value)} /></label></div><label className="field"><span>Pickup or service address *</span><div className="input-with-icon"><MapPin /><input required placeholder="Street, postcode, city" value={form.address} onChange={e => update('address', e.target.value)} /></div></label><label className="field"><span>Estimated duration</span><select value={form.duration} onChange={e => update('duration', e.target.value)}><option>Under 2 hours</option><option>2-3 hours</option><option>Half day</option><option>Full day</option><option>Not sure</option></select></label><label className="field"><span>Anything we should know?</span><textarea rows={4} placeholder="Appointment location, task details, timing flexibility..." value={form.notes} onChange={e => update('notes', e.target.value)} /></label></div>}

              {step === 3 && <div className="form-step"><div className="form-heading"><span className="form-heading__icon"><UserRound /></span><div><h2>Personal preferences</h2><p>These details help us find the right support partner.</p></div></div><label className="field"><span>Mobility</span><select value={form.mobility} onChange={e => update('mobility', e.target.value)}><option>No mobility support needed</option><option>Uses a walking aid</option><option>Uses a wheelchair</option><option>Needs help with steps</option><option>Let’s discuss by phone</option></select></label><label className="field"><span>Transport</span><select value={form.transport} onChange={e => update('transport', e.target.value)}><option>Please coordinate transport</option><option>Transport is already arranged</option><option>No transport needed</option><option>Not sure</option></select></label><label className="field"><span>Preferred language</span><select value={form.language} onChange={e => update('language', e.target.value)}><option>German</option><option>English</option><option>Turkish</option><option>Russian</option><option>Another language</option></select></label><label className="toggle-row"><span><strong>Family journey updates</strong><small>Send authorised arrival, appointment and safe-home updates.</small></span><input type="checkbox" checked={form.familyUpdates} onChange={e => update('familyUpdates', e.target.checked)} /></label></div>}

              {step === 4 && <div className="form-step"><div className="form-heading"><span className="form-heading__icon"><UserRound /></span><div><h2>Who should we contact?</h2><p>We will call to confirm the request and explain the estimated cost.</p></div></div><label className="field"><span>Your name *</span><input required placeholder="Full name" value={form.name} onChange={e => update('name', e.target.value)} /></label><div className="field-grid"><label className="field"><span>Phone number *</span><input required type="tel" placeholder="+49" value={form.phone} onChange={e => update('phone', e.target.value)} /></label><label className="field"><span>Email</span><input type="email" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} /></label></div><div className="summary-card"><div><span>Support</span><strong>{form.service}</strong></div><div><span>When</span><strong>{form.date} at {form.time}</strong></div><div><span>Where</span><strong>{form.address}</strong></div></div><p className="consent-copy">By sending this request, you agree that MitDir may contact you about this booking. No payment is taken now.</p></div>}

              {error&&<div className="form-error">{error}</div>}
              <div className="form-actions">{step > 1 ? <button className="button button--back" type="button" onClick={() => setStep(v => v - 1)}><ArrowLeft /> Back</button> : <span />} {step < 4 ? <button className="button" type="button" disabled={!canContinue} onClick={() => canContinue && setStep(v => v + 1)}>Continue <ArrowRight /></button> : <button className="button" type="submit" disabled={!canContinue||busy}>{busy?'Sending…':'Send request'} <ArrowRight /></button>}</div>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
