import { ArrowRight,CalendarCheck,Check,ChevronDown,Filter,Plus,RefreshCcw,Search,X } from 'lucide-react'
import { FormEvent,useCallback,useEffect,useMemo,useState } from 'react'
import { useParams } from 'react-router-dom'
import { api,dateTime,money } from '../lib/api'
import { useAuth } from '../lib/auth'

type Row=Record<string,unknown>
type Field={key:string;label:string;type?:'text'|'email'|'select'|'textarea';options?:string[]}
type Config={title:string;description:string;apiModule:string;columns:Array<[string,string]>;createFields?:Field[];createLabel?:string;action?:'booking'|'partner'|'user'|'incident'|'expense'|'notification'|'request'}
const configs:Record<string,Config>={
  requests:{title:'Support requests',description:'Review requests submitted from the public booking journey.',apiModule:'public_requests',columns:[['reference','Reference'],['contact_name','Contact'],['service','Service'],['preferred_date','Preferred date'],['contact_phone','Phone'],['status','Status'],['created_at','Submitted']],action:'request'},
  bookings:{title:'Bookings',description:'Review, dispatch and monitor every service request.',apiModule:'bookings',columns:[['booking_number','Booking'],['service','Service'],['senior','Senior'],['scheduled_at','Scheduled'],['partner','Partner'],['status','Status'],['total_amount_cents','Value']],action:'booking'},
  journeys:{title:'Active journeys',description:'Track current assignments and safe-completion milestones.',apiModule:'bookings',columns:[['booking_number','Journey'],['service','Service'],['senior','Senior'],['pickup_address','Pickup'],['scheduled_at','Start'],['partner','Partner'],['status','Progress']],action:'booking'},
  seniors:{title:'Seniors & residents',description:'Profiles, preferences, mobility needs and emergency contacts.',apiModule:'seniors',columns:[['display_name','Name'],['city','City'],['mobility','Mobility'],['preferred_language','Language'],['emergency_contact_name','Emergency contact'],['updated_at','Updated']]},
  partners:{title:'Support partners',description:'Verification, availability, skills and performance.',apiModule:'partners',columns:[['name','Partner'],['verification_status','Verification'],['availability_status','Availability'],['languages','Languages'],['rating','Rating'],['completed_jobs','Completed']],action:'partner'},
  users:{title:'User accounts',description:'Manage access, roles, invitations and account status.',apiModule:'users',columns:[['name','Name'],['email','Email'],['role','Role'],['status','Status'],['last_login_at','Last login'],['created_at','Created']],createLabel:'Invite user',createFields:[{key:'name',label:'Full name'},{key:'email',label:'Email',type:'email'},{key:'phone',label:'Phone'},{key:'role',label:'Role',type:'select',options:['operations','family','senior','partner','care_home']}],action:'user'},
  organizations:{title:'Organisations',description:'Care homes, clinics, mobility and community partners.',apiModule:'organizations',columns:[['name','Organisation'],['type','Type'],['city','City'],['status','Status'],['contact_email','Contact'],['members','Members']],createLabel:'Add organisation',createFields:[{key:'name',label:'Name'},{key:'type',label:'Type',type:'select',options:['care_home','transport','pharmacy','hospital','clinic','municipality','insurer','other']},{key:'address',label:'Address'},{key:'city',label:'City'},{key:'contactEmail',label:'Contact email',type:'email'}]},
  payments:{title:'Payments & billing',description:'Authorisations, invoices, settlements and refunds.',apiModule:'payments',columns:[['booking_number','Booking'],['payer','Payer'],['amount_cents','Amount'],['method','Method'],['status','Status'],['created_at','Created']]},
  expenses:{title:'Expenses & receipts',description:'Purchase receipts, approvals and reimbursement records.',apiModule:'expenses',columns:[['booking_number','Booking'],['description','Description'],['amount_cents','Amount'],['uploaded_by_name','Uploaded by'],['approval_status','Approval'],['created_at','Created']],action:'expense'},
  incidents:{title:'Incidents',description:'Safeguarding reports, escalation and resolution history.',apiModule:'incidents',columns:[['incident_number','Incident'],['title','Title'],['booking_number','Booking'],['severity','Severity'],['status','Status'],['assignee','Assigned'],['created_at','Reported']],createLabel:'Report incident',createFields:[{key:'title',label:'Title'},{key:'severity',label:'Severity',type:'select',options:['low','medium','high','critical']},{key:'description',label:'Description',type:'textarea'}],action:'incident'},
  consents:{title:'Consent records',description:'Task-specific permissions and automatic expiry.',apiModule:'consents',columns:[['booking_number','Booking'],['senior','Senior'],['permission','Permission'],['granted','Granted'],['expires_at','Expires'],['created_at','Created']]},
  services:{title:'Service catalogue',description:'Active services, categories and pricing rules.',apiModule:'services',columns:[['name','Service'],['category','Category'],['description','Description'],['base_price_cents','Base price'],['hourly_rate_cents','Hourly rate'],['active','Active']]},
  audit:{title:'Audit trail',description:'Immutable operational and security activity history.',apiModule:'audit',columns:[['created_at','Time'],['actor','Actor'],['action','Action'],['entity_type','Entity'],['entity_id','Record'],['ip_address','IP address']]},
  notifications:{title:'Notifications',description:'Journey alerts, requests and account messages.',apiModule:'notifications',columns:[['created_at','Time'],['title','Title'],['body','Message'],['type','Type'],['read_at','Read']],action:'notification'},
}

export default function ModulePage(){
  const {module='bookings'}=useParams();const config=configs[module]||configs.bookings;const {user}=useAuth();const [items,setItems]=useState<Row[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [search,setSearch]=useState('');const [createOpen,setCreateOpen]=useState(false)
  const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await api<{items:Row[]}>(`/api/data?module=${config.apiModule}`);let next=r.items;if(module==='journeys')next=next.filter(i=>['matched','confirmed','in_progress','incident'].includes(String(i.status)));setItems(next)}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[config.apiModule,module])
  useEffect(()=>{void Promise.resolve().then(load)},[load])
  const filtered=useMemo(()=>items.filter(i=>JSON.stringify(i).toLowerCase().includes(search.toLowerCase())),[items,search])
  async function patch(row:Row,value:string){
    const body:Row={id:row.id}
    if(config.action==='booking'||config.action==='request')body.status=value
    if(config.action==='partner'){
      if(user?.role==='partner')body.availabilityStatus=value
      else body.verificationStatus=value
    }
    if(config.action==='user'){
      if(value==='__reset_password')body.resetPassword=true
      else body.status=value
    }
    if(config.action==='incident')body.status=value
    if(config.action==='expense')body.approvalStatus=value
    if(config.action==='notification')body.id=row.id
    const response=await api<{item:Row}>(`/api/data?module=${config.apiModule}`,{method:'PATCH',body:JSON.stringify(body)})
    if(response.item.temporaryPassword)setNotice(`Temporary password for ${String(response.item.email)}: ${String(response.item.temporaryPassword)}`)
    await load()
  }
  return <div className="portal-page"><div className="module-heading"><div><span className="portal-kicker">MitDir module</span><h1>{config.title}</h1><p>{config.description}</p></div><div>{(config.createFields||module==='bookings')&&<button className="button" onClick={()=>module==='bookings'?location.assign('/book'):setCreateOpen(true)}><Plus/>{config.createLabel||'New booking'}</button>}</div></div>
    {notice&&<div className="portal-notice"><strong>Credential generated</strong><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss credential"><X/></button></div>}
    <section className="portal-panel module-table-panel"><div className="module-toolbar"><div className="module-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${config.title.toLowerCase()}…`}/></div><button><Filter/>Filter<ChevronDown/></button><button onClick={load}><RefreshCcw/>Refresh</button><span>{filtered.length} records</span></div>
      {error?<div className="portal-error">{error}</div>:loading?<div className="module-loading"><i/><span>Loading {config.title.toLowerCase()}…</span></div>:<div className="module-table-wrap"><table className="module-table"><thead><tr>{config.columns.map(c=><th key={c[0]}>{c[1]}</th>)}{config.action&&<th>Action</th>}</tr></thead><tbody>{filtered.map(row=><tr key={String(row.id)}>{config.columns.map(([key])=><td key={key}>{renderValue(key,row[key])}</td>)}{config.action&&<td>{actionControl(config.action,row,user!.role,patch)}</td>}</tr>)}</tbody></table>{!filtered.length&&<div className="empty-state"><CalendarCheck/><strong>No records found</strong><span>Try another search or create a new record.</span></div>}</div>}
    </section>{createOpen&&config.createFields&&<CreateDialog config={config} onClose={()=>setCreateOpen(false)} onCreated={()=>{setCreateOpen(false);void load()}}/>}
  </div>
}

function renderValue(key:string,value:unknown){
  if(value===null||value===undefined||value==='')return <span className="muted">—</span>
  if(key.includes('_at')||key==='scheduled_at'||key==='expires_at')return dateTime(String(value))
  if(key.endsWith('_cents'))return money(Number(value))
  if(typeof value==='boolean')return value?<span className="table-check"><Check/>Yes</span>:<span className="muted">No</span>
  if(Array.isArray(value))return value.join(', ')
  if(['status','verification_status','availability_status','severity','approval_status','role','type','category'].includes(key))return <span className={`table-badge table-badge--${String(value)}`}>{String(value).replaceAll('_',' ')}</span>
  return String(value)
}

function actionControl(action:Config['action'],row:Row,role:string,patch:(r:Row,v:string)=>Promise<void>){
  if(action==='notification')return row.read_at?<span className="muted">Read</span>:<button className="table-action" onClick={()=>patch(row,'read')}>Mark read</button>
  const canEdit=action==='booking'?['admin','operations','partner'].includes(role):action==='partner'?['admin','operations','partner'].includes(role):action==='user'?role==='admin':['admin','operations'].includes(role)
  if(!canEdit)return <span className="muted">View only</span>
  const options=action==='booking'&&role==='partner'?['in_progress','completed','incident']:action==='booking'?['review','matched','confirmed','in_progress','completed','cancelled']:action==='request'?['new','contacted','converted','closed']:action==='partner'&&role==='partner'?['available','busy','away','offline']:action==='partner'?['pending','review','verified','rejected','suspended']:action==='user'?['active','invited','suspended','pending']:action==='incident'?['open','investigating','resolved','closed']:['pending','approved','rejected']
  const value=String(row[action==='partner'?'verification_status':action==='expense'?'approval_status':'status'])
  const selected=action==='partner'&&role==='partner'?String(row.availability_status):value
  return <div className="table-actions"><select className="table-select" value={selected} onChange={e=>void patch(row,e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select>{action==='user'&&<button className="table-action" onClick={()=>void patch(row,'__reset_password')}>Reset password</button>}</div>
}

function CreateDialog({config,onClose,onCreated}:{config:Config;onClose:()=>void;onCreated:()=>void}){
  const [values,setValues]=useState<Record<string,string>>({});const [error,setError]=useState('');const [credential,setCredential]=useState('');const [busy,setBusy]=useState(false)
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const response=await api<{item:Row}>(`/api/data?module=${config.apiModule}`,{method:'POST',body:JSON.stringify(values)});if(response.item.temporaryPassword)setCredential(String(response.item.temporaryPassword));else onCreated()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}
  if(credential)return <div className="portal-modal" role="dialog" aria-modal="true"><div className="portal-modal__card"><span className="portal-kicker">Account created</span><h2>Share this temporary password securely</h2><p>It is shown once here. Ask the user to change it after signing in.</p><div className="credential-box"><span>{values.email}</span><strong>{credential}</strong></div><div className="portal-modal__actions"><button className="button" onClick={onCreated}>Done<ArrowRight/></button></div></div></div>
  return <div className="portal-modal" role="dialog" aria-modal="true"><div className="portal-modal__card"><button className="portal-modal__close" onClick={onClose}><X/></button><span className="portal-kicker">Create record</span><h2>{config.createLabel}</h2><p>Add the details below. The action will be stored in the audit trail.</p>{error&&<div className="form-error">{error}</div>}<form onSubmit={submit}>{config.createFields!.map(field=><label className="field" key={field.key}><span>{field.label}</span>{field.type==='select'?<select required value={values[field.key]||''} onChange={e=>setValues({...values,[field.key]:e.target.value})}><option value="">Select…</option>{field.options?.map(o=><option key={o} value={o}>{o.replaceAll('_',' ')}</option>)}</select>:field.type==='textarea'?<textarea required rows={4} value={values[field.key]||''} onChange={e=>setValues({...values,[field.key]:e.target.value})}/>:<input required={field.key!=='phone'&&field.key!=='address'&&field.key!=='city'} type={field.type||'text'} value={values[field.key]||''} onChange={e=>setValues({...values,[field.key]:e.target.value})}/>}</label>)}<div className="portal-modal__actions"><button type="button" onClick={onClose}>Cancel</button><button className="button" disabled={busy}>{busy?'Saving…':'Create'}<ArrowRight/></button></div></form></div></div>
}
