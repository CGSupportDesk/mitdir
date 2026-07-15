import { Link } from 'react-router-dom'

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link className={`logo ${light ? 'logo--light' : ''}`} to="/" aria-label="MitDir home">
      <span className="logo__mark" aria-hidden="true">M</span>
      <span className="logo__name">MitDir</span>
    </Link>
  )
}
