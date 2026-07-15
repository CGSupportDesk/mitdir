export async function api<T>(path:string,options:RequestInit={}){
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})},credentials:'same-origin'})
  const data=await response.json().catch(()=>({}))
  if(!response.ok) throw new Error(data.error||'Something went wrong')
  return data as T
}

export function money(cents:number|undefined,currency='EUR'){
  return new Intl.NumberFormat('en-DE',{style:'currency',currency}).format((cents||0)/100)
}

export function dateTime(value:string|undefined){
  if(!value)return '—'
  return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
}
