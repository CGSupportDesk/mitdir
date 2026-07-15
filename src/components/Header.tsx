import { Menu, Phone, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

export default function Header({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <header className={`site-header ${compact ? 'site-header--compact' : ''}`}>
      <div className="container site-header__inner">
        <Logo />
        <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle navigation">
          {open ? <X /> : <Menu />}
        </button>
        <nav className={`nav ${open ? 'nav--open' : ''}`} aria-label="Main navigation">
          {!compact && <><a href="/#services">Services</a><a href="/#how">How it works</a><a href="/#safety">Safety</a></>}
          <Link to="/app">Sign in</Link>
          <a className="nav__phone" href="tel:+497211234567"><Phone size={17} /> +49 721 123 4567</a>
          <Link className="button button--small" to="/book">Book support</Link>
        </nav>
      </div>
    </header>
  )
}
