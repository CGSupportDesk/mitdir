import { Activity,AlertTriangle,Banknote,BookOpen,Building2,CalendarDays,ChevronLeft,ChevronRight,ClipboardCheck,FileClock,HeartHandshake,Home,Inbox,LogOut,Menu,Receipt,Settings,ShieldCheck,UserRound,UsersRound,X } from 'lucide-react'
import { useState } from 'react'
import { NavLink,Outlet,useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { useAuth,type Role } from '../lib/auth'

type NavItem={to:string;label:string;icon:typeof Home;roles:Role[]}
const all:Role[]=['admin','operations','family','senior','partner','care_home']
const nav:NavItem[]=[
  {to:'/app',label:'Overview',icon:Home,roles:all},
  {to:'/app/requests',label:'Support requests',icon:Inbox,roles:['admin','operations']},
  {to:'/app/bookings',label:'Bookings',icon:CalendarDays,roles:all},
  {to:'/app/journeys',label:'Active journeys',icon:Activity,roles:all},
  {to:'/app/seniors',label:'Seniors & residents',icon:HeartHandshake,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/partners',label:'Support partners',icon:UsersRound,roles:['admin','operations','care_home','partner']},
  {to:'/app/users',label:'User accounts',icon:UserRound,roles:['admin','operations']},
  {to:'/app/organizations',label:'Organisations',icon:Building2,roles:['admin','operations','care_home']},
  {to:'/app/payments',label:'Payments & billing',icon:Banknote,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/expenses',label:'Expenses & receipts',icon:Receipt,roles:['admin','operations','partner','family']},
  {to:'/app/incidents',label:'Incidents',icon:AlertTriangle,roles:['admin','operations','partner']},
  {to:'/app/consents',label:'Consent records',icon:ShieldCheck,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/services',label:'Service catalogue',icon:BookOpen,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/audit',label:'Audit trail',icon:FileClock,roles:['admin']},
  {to:'/app/notifications',label:'Notifications',icon:ClipboardCheck,roles:all},
  {to:'/app/settings',label:'Settings',icon:Settings,roles:all},
]

export default function AppLayout(){
  const {user,logout}=useAuth();const navigate=useNavigate();const [collapsed,setCollapsed]=useState(false);const [mobile,setMobile]=useState(false)
  if(!user)return null
  async function signOut(){await logout();navigate('/')}
  return <div className={`portal ${collapsed?'portal--collapsed':''}`}>
    <aside className={`portal-sidebar ${mobile?'portal-sidebar--open':''}`}>
      <div className="portal-sidebar__top"><Logo light/><button onClick={()=>setMobile(false)} className="portal-mobile-close" aria-label="Close menu"><X/></button></div>
      <div className="portal-role"><span>{user.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><strong>{user.name}</strong><small>{user.role.replace('_',' ')} account</small></div></div>
      <nav className="portal-nav">{nav.filter(item=>item.roles.includes(user.role)).map(item=><NavLink end={item.to==='/app'} to={item.to} key={item.to} onClick={()=>setMobile(false)}><item.icon/><span>{item.label}</span></NavLink>)}</nav>
      <button className="portal-signout" onClick={signOut}><LogOut/><span>Sign out</span></button>
      <button className="portal-collapse" onClick={()=>setCollapsed(!collapsed)} aria-label="Collapse sidebar">{collapsed?<ChevronRight/>:<ChevronLeft/>}</button>
    </aside>
    <div className="portal-workspace">
      <header className="portal-header"><button className="portal-menu" onClick={()=>setMobile(true)} aria-label="Open menu"><Menu/></button><div><span>MitDir operations platform</span><strong>{new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</strong></div><div className="portal-header__actions"><NavLink to="/app/notifications"><ClipboardCheck/></NavLink><span className="portal-avatar">{user.name.charAt(0)}</span></div></header>
      <main className="portal-content"><Outlet/></main>
    </div>
  </div>
}
