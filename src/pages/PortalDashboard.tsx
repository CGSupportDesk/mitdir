import { Activity,AlertTriangle,ArrowRight,Banknote,CalendarCheck,Check,Clock,ShieldCheck,UserCheck,UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { api,dateTime,money } from '../lib/api'
import { useAuth } from '../lib/auth'

type DashboardData={user:{name:string;role:string};metrics?:Record<string,number>;bookings?:Array<Record<string,unknown>>;incidents?:Array<Record<string,unknown>>;partners?:Array<Record<string,unknown>>;notifications?:Array<Record<string,unknown>>}
type MetricCard=[string,string|number,string,LucideIcon,string]

export default function PortalDashboard(){
  const {user}=useAuth();const [data,setData]=useState<DashboardData|null>(null);const [error,setError]=useState('')
  useEffect(()=>{api<DashboardData>('/api/dashboard').then(setData).catch(e=>setError(e.message))},[])
  if(error)return <div className="portal-error">{error}</div>
  if(!data)return <div className="module-loading"><i/><span>Loading your workspace…</span></div>
  const admin=['admin','operations'].includes(user!.role);const partner=user!.role==='partner';const metrics=data.metrics||{}
  const cards:MetricCard[]=admin?[
    ['Needs dispatch',metrics.unassigned||0,'Requests waiting for review',CalendarCheck,'amber'],['Journeys today',metrics.today||0,'Across all service partners',Activity,'blue'],['Partner reviews',metrics.partner_reviews||0,'Verification tasks pending',UserCheck,'violet'],['Open incidents',metrics.open_incidents||0,'Require operations follow-up',AlertTriangle,'red'],
  ]:partner?[
    ['Upcoming',metrics.upcoming||0,'Confirmed assignments',CalendarCheck,'blue'],['Completed',metrics.completed||0,'All completed journeys',Check,'green'],['Journey value',money(metrics.earnings_cents||0),'Completed service value',Banknote,'amber'],
  ]:[
    ['Upcoming support',metrics.upcoming||0,'Active and confirmed bookings',CalendarCheck,'blue'],['Completed journeys',metrics.completed||0,'Support delivered safely',Check,'green'],['Secure access','Active','Your permissions are protected',ShieldCheck,'violet'],
  ]
  return <div className="portal-page"><div className="portal-page__heading"><div><span className="portal-kicker">{admin?'Operations centre':partner?'Partner workspace':'Your care workspace'}</span><h1>{greeting()}, {user!.name.split(' ')[0]}.</h1><p>{admin?'Here is what needs attention across MitDir today.':partner?'Your assignments and journey updates are ready.':'Everything related to your support, in one calm place.'}</p></div><Link className="button" to={partner?'/app/bookings':'/book'}>{partner?'View assignments':'New booking'}<ArrowRight/></Link></div>
    <div className="metric-grid">{cards.map(([label,value,desc,Icon,tone])=><article className={`metric-card metric-card--${tone}`} key={String(label)}><div><span>{String(label)}</span><strong>{String(value)}</strong><small>{String(desc)}</small></div><i><Icon/></i></article>)}</div>
    <div className="overview-grid"><section className="portal-panel portal-panel--wide"><div className="panel-title"><div><span>{admin?'Live operations':'Your schedule'}</span><h2>{admin?'Recent bookings':'Bookings and assignments'}</h2></div><Link to="/app/bookings">View all <ArrowRight/></Link></div><div className="portal-list">{(data.bookings||[]).slice(0,6).map(item=><Link className="booking-list-row" to="/app/bookings" key={String(item.id)}><span className={`status-dot status-dot--${item.status}`}/><div><strong>{String(item.service||'Support journey')}</strong><small>{String(item.booking_number)} · {String(item.senior||'Support recipient')}</small></div><div><b>{dateTime(String(item.scheduled_at))}</b><small>{String(item.status).replace('_',' ')}</small></div><ArrowRight/></Link>)}{!data.bookings?.length&&<div className="empty-state"><CalendarCheck/><strong>No bookings yet</strong><span>Your next journey will appear here.</span></div>}</div></section>
      <aside className="overview-side">{admin?<><section className="portal-panel"><div className="panel-title"><div><span>Safeguarding</span><h2>Incident queue</h2></div><Link to="/app/incidents">Open</Link></div>{(data.incidents||[]).slice(0,4).map(i=><div className="compact-row" key={String(i.id)}><span className={`severity severity--${i.severity}`}>{String(i.severity)}</span><div><strong>{String(i.title)}</strong><small>{String(i.incident_number)} · {String(i.status)}</small></div></div>)}</section><section className="portal-panel"><div className="panel-title"><div><span>Network</span><h2>Support partners</h2></div><Link to="/app/partners">Manage</Link></div><div className="partner-stack">{(data.partners||[]).map(p=><div key={String(p.id)}><span>{String(p.name).split(' ').map((n:string)=>n[0]).join('')}</span><div><strong>{String(p.name)}</strong><small>{String(p.availability_status)} · ★ {String(p.rating)}</small></div></div>)}</div></section></>:<section className="portal-panel help-panel"><span><UsersRound/></span><h2>Your MitDir concierge</h2><p>Need to change a journey or talk through a concern? We coordinate the details.</p><a href="tel:+497211234567">+49 721 123 4567</a></section>}</aside>
    </div>
    {admin&&<section className="portal-panel operations-strip"><div><Clock/><span><strong>Operations coverage</strong>Active journey monitoring is online.</span></div><div><ShieldCheck/><span><strong>Consent controls</strong>All task permissions are auditable.</span></div><div><Banknote/><span><strong>Month-to-date revenue</strong>{money(metrics.revenue_cents||0)}</span></div></section>}
  </div>
}

function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening'}
