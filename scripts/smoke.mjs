import './env.mjs'

const base=(process.argv[2]||'http://127.0.0.1:4175').replace(/\/$/,'')
const demoPassword=process.env.DEMO_PASSWORD
const adminPassword=process.env.ADMIN_PASSWORD
if(!demoPassword||!adminPassword)throw new Error('Demo credentials are not configured')

async function request(path,options={}){
  const response=await fetch(`${base}${path}`,options)
  const body=await response.json().catch(()=>({}))
  return {response,body}
}

async function login(email,password){
  const {response,body}=await request('/api/auth?action=login',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({email,password})})
  if(response.status!==200)throw new Error(`${email} login failed (${response.status}): ${body.error||'unknown error'}`)
  const cookie=response.headers.get('set-cookie')?.split(';')[0]
  if(!cookie)throw new Error(`${email} did not receive a session cookie`)
  return {user:body.user,cookie}
}

const health=await request('/api/health')
if(health.response.status!==200||health.body.database!=='connected')throw new Error('Health check failed')

const accounts=[
  ['admin@mitdir.de',adminPassword,'admin'],
  ['operations@mitdir.de',demoPassword,'operations'],
  ['family@mitdir.de',demoPassword,'family'],
  ['senior@mitdir.de',demoPassword,'senior'],
  ['partner@mitdir.de',demoPassword,'partner'],
  ['carehome@mitdir.de',demoPassword,'care_home'],
]
const sessions=new Map()
for(const [email,password,role] of accounts){
  const session=await login(email,password)
  if(session.user.role!==role)throw new Error(`${email} returned the wrong role`)
  const dashboard=await request('/api/dashboard',{headers:{cookie:session.cookie}})
  if(dashboard.response.status!==200)throw new Error(`${email} dashboard failed (${dashboard.response.status})`)
  sessions.set(role,session)
}

const familyUsers=await request('/api/data?module=users',{headers:{cookie:sessions.get('family').cookie}})
if(familyUsers.response.status!==403)throw new Error('Family account could access user administration')
const partnerProfile=await request('/api/data?module=partners',{headers:{cookie:sessions.get('partner').cookie}})
if(partnerProfile.response.status!==200||partnerProfile.body.items?.length!==1)throw new Error('Partner self-profile access failed')

const publicRequest=await request('/api/public-request',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({service:'Medical journey',forWho:'A parent or loved one',date:'2026-08-20',time:'10:30',address:'Teststrasse 10, 76133 Karlsruhe',duration:'2-3 hours',mobility:'No mobility support needed',transport:'Please coordinate transport',language:'German',familyUpdates:true,notes:'Automated end-to-end verification record.',name:'MitDir QA Check',phone:'+49 721 000 0000',email:'qa@example.test'})})
if(publicRequest.response.status!==201||!publicRequest.body.reference)throw new Error(`Public request failed (${publicRequest.response.status})`)

const admin=sessions.get('admin')
const queue=await request('/api/data?module=public_requests',{headers:{cookie:admin.cookie}})
const submitted=queue.body.items?.find(item=>item.reference===publicRequest.body.reference)
if(queue.response.status!==200||!submitted)throw new Error('Submitted support request was not visible to administrators')
const close=await request('/api/data?module=public_requests',{method:'PATCH',headers:{cookie:admin.cookie,'content-type':'application/json',origin:base},body:JSON.stringify({id:submitted.id,status:'closed'})})
if(close.response.status!==200||close.body.item?.status!=='closed')throw new Error(`Support request status update failed (${close.response.status}): ${JSON.stringify(close.body)}`)

console.log(`Smoke checks passed for health, ${accounts.length} roles, access boundaries, and ${publicRequest.body.reference}.`)
