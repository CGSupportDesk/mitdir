import {
  ArrowRight, CalendarCheck, Check, ChevronDown, ClipboardCheck, HeartHandshake,
  Home, MapPin, Pill, Phone, ShieldCheck, ShoppingBag, Sparkles, Users, Waypoints,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Logo from '../components/Logo'

const services = [
  { icon: CalendarCheck, title: 'Medical journeys', text: 'A verified companion for appointments, hospital navigation, waiting support and a safe return home.', tone: 'mint' },
  { icon: Waypoints, title: 'Mobility support', text: 'Door-to-door accompaniment and licensed transport coordination, matched to mobility needs.', tone: 'blue' },
  { icon: ShoppingBag, title: 'Essential errands', text: 'Prescription collection, pharmacy visits, groceries and everyday household essentials.', tone: 'sand' },
  { icon: Home, title: 'Home & social', text: 'Light household help, walks, companionship, organisation and simple technology support.', tone: 'rose' },
]

const steps = [
  ['01', 'Tell us what you need', 'Call us or use the simple booking form. A family member can book remotely, too.'],
  ['02', 'We understand the details', 'We confirm time, place, mobility, language, transport and consent preferences.'],
  ['03', 'Meet your support partner', 'We match a verified partner and share their profile before they arrive.'],
  ['04', 'Follow the journey', 'Receive clear milestone updates from arrival through safe completion.'],
]

const faqs = [
  ['Is MitDir a nursing service?', 'No. MitDir is strictly non-clinical. We coordinate practical everyday assistance and do not diagnose, administer medication or replace qualified nursing professionals.'],
  ['Can I book for a parent who lives elsewhere?', 'Yes. Family members can arrange and pay for support remotely, set permissions and receive the updates their parent has authorised.'],
  ['How are support partners selected?', 'Partners complete identity, right-to-work, reference and background checks where legally permitted, plus safeguarding and confidentiality training.'],
  ['What if the assigned partner becomes unavailable?', 'Every journey includes a backup process. Our operations team coordinates a suitable replacement and keeps you informed.'],
]

export default function Landing() {
  return (
    <div className="landing">
      <Header />
      <main>
        <section className="hero">
          <div className="hero__wash" />
          <div className="container hero__inner">
            <div className="hero__copy reveal">
              <div className="eyebrow eyebrow--light"><Sparkles size={15} /> Everyday help, thoughtfully coordinated</div>
              <h1>Your day, made easier.<br /><em>Right by your side.</em></h1>
              <p>One trusted place to arrange practical support for older adults - from hospital appointments to errands, companionship and a safe return home.</p>
              <div className="hero__actions">
                <Link className="button button--gold" to="/book">Book support <ArrowRight size={18} /></Link>
                <a className="button button--ghost" href="tel:+497211234567"><Phone size={18} /> Call our concierge</a>
              </div>
              <div className="hero__trust">
                <span><ShieldCheck /> Verified partners</span>
                <span><ClipboardCheck /> Clear consent</span>
                <span><HeartHandshake /> Human support</span>
              </div>
            </div>
            <div className="hero__visual">
              <div className="hero__image-wrap"><img src="/images/hero-care.webp" alt="A caregiver warmly supporting an older woman at home" /></div>
              <div className="journey-card">
                <div className="journey-card__icon"><Check /></div>
                <div><span>Journey completed</span><strong>Anna is safely home</strong><small>Family updated at 15:42</small></div>
              </div>
              <div className="hero__location"><MapPin /> Pilot region<br /><strong>Karlsruhe</strong></div>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Service values">
          <div className="container trust-strip__inner">
            <p>One request</p><span /> <p>One coordinated journey</p><span /> <p>One trusted point of contact</p>
          </div>
        </section>

        <section className="section services" id="services">
          <div className="container">
            <div className="section-heading section-heading--split">
              <div><div className="eyebrow">What we can arrange</div><h2>Everyday support,<br />all in one place.</h2></div>
              <p>Small tasks should not require five providers and five different apps. MitDir coordinates the complete service around the person.</p>
            </div>
            <div className="services__grid">
              {services.map(({ icon: Icon, title, text, tone }) => (
                <article className={`service-card service-card--${tone}`} key={title}>
                  <div className="service-card__icon"><Icon /></div><h3>{title}</h3><p>{text}</p>
                  <Link to="/book">Arrange support <ArrowRight size={17} /></Link>
                </article>
              ))}
            </div>
            <div className="post-discharge">
              <div className="post-discharge__icon"><Pill /></div>
              <div><span>Care Journey</span><h3>One appointment. Every detail covered.</h3><p>Collection, licensed transport, hospital accompaniment, prescription pickup, return journey and family update - coordinated from beginning to end.</p></div>
              <Link className="button button--light" to="/book">Plan a care journey <ArrowRight size={17} /></Link>
            </div>
          </div>
        </section>

        <section className="section human-section">
          <div className="container human-section__grid">
            <div className="photo-stack">
              <img className="photo-stack__main" src="/images/senior-garden.jpg" alt="An older woman enjoying time outdoors" />
              <div className="photo-stack__note"><strong>Support that fits real life.</strong><span>A few hours when you need them - not a one-size-fits-all care package.</span></div>
            </div>
            <div className="human-section__copy">
              <div className="eyebrow">Why MitDir</div><h2>Help should feel human, not complicated.</h2>
              <p className="lead">Finding support is only the beginning. The real challenge is coordinating it, trusting it and knowing everything went well.</p>
              <div className="check-list">
                <div><Check /><span><strong>A real person when you call</strong>Our trained concierge can book the complete journey by telephone.</span></div>
                <div><Check /><span><strong>Visibility without intrusion</strong>Families receive only the updates the older adult has authorised.</span></div>
                <div><Check /><span><strong>Support when plans change</strong>A clear backup process means you are never left to start again alone.</span></div>
              </div>
              <Link className="text-link" to="/book">See what a booking feels like <ArrowRight size={18} /></Link>
            </div>
          </div>
        </section>

        <section className="section how" id="how">
          <div className="container">
            <div className="section-heading section-heading--center"><div className="eyebrow">How MitDir works</div><h2>From request to safe completion.</h2><p>Clear at every step. Human when it matters.</p></div>
            <div className="steps">
              {steps.map(([number, title, text]) => <article className="step" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
            </div>
            <div className="how__action"><Link className="button" to="/book">Start a booking <ArrowRight size={18} /></Link></div>
          </div>
        </section>

        <section className="section safety" id="safety">
          <div className="container safety__grid">
            <div className="safety__copy"><div className="eyebrow eyebrow--light">Trust, safety & consent</div><h2>Built around the person. Never anonymous.</h2><p>Every safeguard is designed to protect independence, privacy and peace of mind.</p><Link className="button button--gold" to="/book">Book with confidence <ArrowRight size={18} /></Link></div>
            <div className="safety__cards">
              <div><ShieldCheck /><h3>Verified support partners</h3><p>Identity, references, right-to-work checks and role-specific safeguarding.</p></div>
              <div><Users /><h3>Task-specific consent</h3><p>The older adult decides who may enter, accompany, purchase or update family.</p></div>
              <div><MapPin /><h3>Milestone updates</h3><p>Arrival, appointment, return journey and safe-home confirmations in one place.</p></div>
              <div><HeartHandshake /><h3>Backup support</h3><p>A human operations team monitors active journeys and handles replacements.</p></div>
            </div>
          </div>
        </section>

        <section className="section testimonial">
          <div className="container testimonial__inner">
            <img src="/images/community.jpg" alt="Older adults spending time together" />
            <blockquote><span>“</span><p>I could be there for Mum without being in the same city. I knew when her companion arrived, when the appointment ended and when she was safely home.</p><footer>— A family story, illustrating the MitDir experience</footer></blockquote>
          </div>
        </section>

        <section className="section faq">
          <div className="container faq__grid">
            <div><div className="eyebrow">Good to know</div><h2>Questions, answered simply.</h2><p>Still unsure? Our concierge will listen first and explain the right next step.</p><a className="text-link" href="tel:+497211234567"><Phone size={18} /> Speak with us</a></div>
            <div className="faq__items">{faqs.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}<ChevronDown /></summary><p>{a}</p></details>)}</div>
          </div>
        </section>

        <section className="final-cta">
          <div className="container final-cta__inner"><div><div className="eyebrow eyebrow--light">Ready when you are</div><h2>One less thing to worry about.</h2><p>Tell us what would make the day easier. We will coordinate the rest.</p></div><div className="final-cta__actions"><Link className="button button--gold" to="/book">Book support <ArrowRight size={18} /></Link><a href="tel:+497211234567">or call +49 721 123 4567</a></div></div>
        </section>
      </main>
      <footer className="footer">
        <div className="container footer__grid"><div><Logo light /><p>Everyday help. Right by your side.<br />Non-clinical support coordinated with care.</p></div><div><strong>Explore</strong><a href="/#services">Services</a><a href="/#how">How it works</a><a href="/#safety">Trust & safety</a></div><div><strong>For families</strong><Link to="/book">Book support</Link><Link to="/dashboard">Family dashboard</Link><a href="tel:+497211234567">Telephone concierge</a></div><div><strong>Pilot region</strong><p>Karlsruhe<br />Baden-Württemberg, Germany</p></div></div>
        <div className="container footer__bottom"><span>© 2026 MitDir. A Beyond ClosingGap initiative.</span><span>Privacy · Imprint · Accessibility</span></div>
      </footer>
    </div>
  )
}
