import { ArrowLeft, Calendar, Check, Clock, Download, HeartHandshake, MapPin, MessageCircle, Phone, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Header from '../components/Header'

type StoredBooking = { id: string; service: string; date: string; time: string; address: string; name: string }

const defaultBooking: StoredBooking = { id: 'MD-28419', service: 'Medical journey', date: '2026-07-22', time: '09:30', address: 'Gartenstraße 18, Karlsruhe', name: 'Kristom Robert' }

export default function Dashboard() {
  const [params] = useSearchParams()
  const [booking] = useState<StoredBooking>(() => {
    const raw = localStorage.getItem('mitdir-booking')
    if (!raw) return defaultBooking
    try { return JSON.parse(raw) as StoredBooking } catch { return defaultBooking }
  })
  const [notice, setNotice] = useState(params.get('new') === '1')
  useEffect(() => {
    if (notice) { const t = window.setTimeout(() => setNotice(false), 5000); return () => clearTimeout(t) }
  }, [notice])

  const date = booking.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date to be confirmed'
  return (
    <div className="dashboard-page">
      <Header compact />
      {notice && <div className="toast"><Check /> Request received. A coordinator will call you shortly.</div>}
      <main className="dashboard-main container">
        <div className="dashboard-title"><div><Link to="/" className="back-link"><ArrowLeft /> Back to home</Link><span className="dashboard-title__hello">Family dashboard</span><h1>Good morning, {booking.name?.split(' ')[0] || 'Kristom'}.</h1><p>Here is the latest on your family's MitDir support.</p></div><Link className="button" to="/book"><Plus /> New booking</Link></div>

        <section className="active-journey">
          <div className="active-journey__top"><div><span className="status-pill"><span /> {params.get('new') === '1' ? 'Request received' : 'Partner confirmed'}</span><p>Booking {booking.id}</p></div><button className="icon-button" aria-label="More options">•••</button></div>
          <div className="active-journey__grid">
            <div className="journey-summary"><div className="eyebrow">Upcoming support</div><h2>{booking.service}</h2><div className="journey-summary__details"><span><Calendar /> <b>{date}</b></span><span><Clock /> {booking.time || 'Time to be confirmed'}</span><span><MapPin /> {booking.address || 'Address to be confirmed'}</span></div><div className="partner"><div className="partner__avatar">LM</div><div><small>Your support partner</small><strong>Leonie Müller <ShieldCheck /></strong><span>Verified · German & English</span></div><a href="tel:+497211234567" aria-label="Call support partner"><Phone /></a></div></div>
            <div className="journey-progress"><h3>Journey progress</h3><div className="timeline"><div className="timeline__item timeline__item--done"><span><Check /></span><div><strong>Booking confirmed</strong><small>16 July · 10:22</small></div></div><div className="timeline__item timeline__item--done"><span><Check /></span><div><strong>Support partner assigned</strong><small>Leonie's profile shared with family</small></div></div><div className="timeline__item timeline__item--current"><span>3</span><div><strong>Partner arrival</strong><small>{date} · {booking.time}</small></div></div><div className="timeline__item"><span>4</span><div><strong>Appointment & safe return</strong><small>Live updates will appear here</small></div></div></div></div>
          </div>
          <div className="active-journey__actions"><button><MessageCircle /> Message coordinator</button><button><Calendar /> View booking details</button><button><Download /> Download confirmation</button></div>
        </section>

        <div className="dashboard-grid">
          <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">Previous support</span><h2>Booking history</h2></div><button>View all</button></div><div className="history-row"><div className="history-row__icon"><HeartHandshake /></div><div><strong>Pharmacy & grocery collection</strong><span>8 July 2026 · Completed by David K.</span></div><span className="completed-pill"><Check /> Completed</span><b>€42.00</b></div><div className="history-row"><div className="history-row__icon"><UserRound /></div><div><strong>Companionship visit</strong><span>28 June 2026 · Completed by Leonie M.</span></div><span className="completed-pill"><Check /> Completed</span><b>€54.00</b></div></section>
          <aside className="dashboard-side"><section className="dashboard-panel family-card"><div className="panel-heading"><div><span className="eyebrow">Care circle</span><h2>Family access</h2></div><button>Manage</button></div><div className="family-person"><span>AR</span><div><strong>Anna Robert</strong><small>Support recipient</small></div></div><div className="family-person"><span>KR</span><div><strong>{booking.name || 'Kristom Robert'}</strong><small>Family organiser · Full access</small></div></div></section><section className="concierge-card"><div><Phone /></div><span>Need to change something?</span><h3>Your concierge is here.</h3><p>Call us and we will coordinate the details.</p><a href="tel:+497211234567">+49 721 123 4567</a></section></aside>
        </div>
      </main>
    </div>
  )
}
