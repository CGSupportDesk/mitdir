import { Accessibility,Activity,AlertTriangle,BadgeEuro,Banknote,BarChart3,BookOpen,Bot,Building2,CalendarDays,ChevronLeft,ChevronRight,ClipboardCheck,FileClock,FileLock2,HeartHandshake,Home,Inbox,Languages,LogOut,MapPinned,Menu,MessageCircle,Receipt,Repeat2,Settings,ShieldCheck,Sparkles,Smartphone,UserPlus,UserRound,UsersRound,WalletCards,X } from 'lucide-react'
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
  {to:'/app/live-journey',label:'Live journeys',icon:Activity,roles:all},
  {to:'/app/care-circle',label:'Care circle',icon:UserPlus,roles:['admin','operations','family','senior']},
  {to:'/app/availability',label:'Availability',icon:CalendarDays,roles:['admin','operations','family','senior','partner','care_home']},
  {to:'/app/messages',label:'Secure messages',icon:MessageCircle,roles:all},
  {to:'/app/recurring',label:'Recurring support',icon:Repeat2,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/safety',label:'Safety centre',icon:AlertTriangle,roles:all},
  {to:'/app/documents',label:'Document vault',icon:FileLock2,roles:all},
  {to:'/app/medication',label:'Medication collection',icon:ClipboardCheck,roles:['admin','operations','family','senior','partner']},
  {to:'/app/seniors',label:'Seniors & residents',icon:HeartHandshake,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/partners',label:'Support partners',icon:UsersRound,roles:['admin','operations','care_home','partner']},
  {to:'/app/matching',label:'Partner matching',icon:Sparkles,roles:['admin','operations']},
  {to:'/app/onboarding',label:'Partner onboarding',icon:ShieldCheck,roles:['admin','operations','partner']},
  {to:'/app/shifts',label:'Shift planner',icon:Smartphone,roles:['admin','operations','partner','care_home']},
  {to:'/app/service-areas',label:'Service areas',icon:MapPinned,roles:['admin','operations']},
  {to:'/app/users',label:'User accounts',icon:UserRound,roles:['admin','operations']},
  {to:'/app/organizations',label:'Organisations',icon:Building2,roles:['admin','operations','care_home']},
  {to:'/app/payments',label:'Payments & billing',icon:Banknote,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/memberships',label:'Memberships',icon:WalletCards,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/invoices',label:'Invoices',icon:BadgeEuro,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/expenses',label:'Expenses & receipts',icon:Receipt,roles:['admin','operations','partner','family']},
  {to:'/app/incidents',label:'Incidents',icon:AlertTriangle,roles:['admin','operations','partner']},
  {to:'/app/consents',label:'Consent records',icon:ShieldCheck,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/services',label:'Service catalogue',icon:BookOpen,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/pricing',label:'Pricing rules',icon:BadgeEuro,roles:['admin','operations']},
  {to:'/app/promotions',label:'Promotions',icon:WalletCards,roles:['admin','operations']},
  {to:'/app/ratings',label:'Ratings',icon:HeartHandshake,roles:['admin','operations','family','senior','partner','care_home']},
  {to:'/app/communications',label:'Delivery log',icon:Languages,roles:['admin','operations','family','senior','partner','care_home']},
  {to:'/app/reports',label:'Operations reports',icon:BarChart3,roles:['admin','operations']},
  {to:'/app/ai',label:'AI concierge',icon:Bot,roles:['admin','operations','family','senior','care_home']},
  {to:'/app/integrations',label:'Integrations',icon:Settings,roles:['admin','operations']},
  {to:'/app/audit',label:'Audit trail',icon:FileClock,roles:['admin']},
  {to:'/app/notifications',label:'Notifications',icon:ClipboardCheck,roles:all},
  {to:'/app/accessibility',label:'Elder-friendly mode',icon:Accessibility,roles:all},
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
