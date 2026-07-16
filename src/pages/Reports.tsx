import { BadgeEuro,BarChart3,CalendarCheck,RefreshCcw,Star,UsersRound } from 'lucide-react'
import { useCallback,useEffect,useState } from 'react'
import { api,money } from '../lib/api'

type Metric={id:string;label:string;value:number;format:string;detail:string}
const icons={revenue:BadgeEuro,utilisation:CalendarCheck,cancellations:BarChart3,partners:UsersRound,rating:Star,outstanding:BadgeEuro}
export default function Reports(){
  const [items,setItems]=useState<Metric[]>([]);const [error,setError]=useState('')
  const load=useCallback(async()=>{try{setItems((await api<{items:Metric[]}>('/api/platform?module=reports')).items)}catch(e){setError((e as Error).message)}},[])
  useEffect(()=>{void Promise.resolve().then(load)},[load])
  return <div className="portal-page"><div className="module-heading"><div><span className="portal-kicker">Business intelligence</span><h1>Operations reports</h1><p>Revenue, utilisation, cancellation, workforce and satisfaction at a glance.</p></div><button className="button" onClick={()=>void load()}><RefreshCcw/>Refresh</button></div>{error&&<div className="portal-error">{error}</div>}<div className="report-grid">{items.map(item=>{const Icon=icons[item.id as keyof typeof icons]||BarChart3;const value=item.format==='money'?money(item.value):item.format==='percent'?`${item.value}%`:item.format==='rating'?`${item.value} / 5`:String(item.value);return <article className="portal-panel report-card" key={item.id}><span><Icon/></span><small>{item.label}</small><strong>{value}</strong><p>{item.detail}</p></article>})}</div><section className="portal-panel report-note"><BarChart3/><span><strong>Export-ready foundation</strong><small>Invoice data and German VAT fields are structured for accounting exports. Provider-specific DATEV export can be connected when the target accounting workflow is confirmed.</small></span></section></div>
}
