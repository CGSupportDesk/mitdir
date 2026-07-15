import { createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode } from 'react'
import { Navigate,useLocation } from 'react-router-dom'
import { api } from './api'

export type Role='admin'|'operations'|'family'|'senior'|'partner'|'care_home'
export type AppUser={id:string;email:string;name:string;role:Role;status:string}
type AuthContextValue={user:AppUser|null;loading:boolean;login:(email:string,password:string)=>Promise<AppUser>;register:(data:{name:string;email:string;phone?:string;password:string;role:'family'|'senior'})=>Promise<AppUser>;logout:()=>Promise<void>;refresh:()=>Promise<void>}
const AuthContext=createContext<AuthContextValue|null>(null)

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<AppUser|null>(null); const [loading,setLoading]=useState(true)
  const refresh=useCallback(async()=>{try{const r=await api<{user:AppUser|null}>('/api/auth?action=session');setUser(r.user)}catch{setUser(null)}finally{setLoading(false)}},[])
  useEffect(()=>{void Promise.resolve().then(refresh)},[refresh])
  const value=useMemo<AuthContextValue>(()=>({user,loading,refresh,
    login:async(email,password)=>{const r=await api<{user:AppUser}>('/api/auth?action=login',{method:'POST',body:JSON.stringify({email,password})});setUser(r.user);return r.user},
    register:async data=>{const r=await api<{user:AppUser}>('/api/auth?action=register',{method:'POST',body:JSON.stringify(data)});setUser(r.user);return r.user},
    logout:async()=>{await api('/api/auth?action=logout',{method:'POST'});setUser(null)},
  }),[user,loading,refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Context hooks intentionally live beside the provider so the authentication contract stays cohesive.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value}

export function ProtectedRoute({children}:{children:ReactNode}){
  const {user,loading}=useAuth();const location=useLocation()
  if(loading)return <div className="portal-loading"><span>MitDir</span><i /></div>
  if(!user)return <Navigate to="/login" state={{from:location.pathname}} replace />
  return children
}
