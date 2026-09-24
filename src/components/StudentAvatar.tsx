import { useEffect, useState } from 'react';

interface StudentAvatarProps { photo?: string|null; firstName?: string|null; lastName?: string|null; size?: 'sm'|'md'|'lg'|'xl'; className?: string; }
const sizes={sm:'h-10 w-10 text-sm',md:'h-12 w-12 text-base',lg:'h-16 w-16 text-xl',xl:'h-32 w-32 text-4xl'};

export default function StudentAvatar({photo,firstName,lastName,size='md',className=''}:StudentAvatarProps){
  const [loading,setLoading]=useState(Boolean(photo));const [failed,setFailed]=useState(false);
  useEffect(()=>{setFailed(false);setLoading(Boolean(photo));},[photo]);
  const initials=`${firstName?.trim().charAt(0)||''}${lastName?.trim().charAt(0)||''}`.toUpperCase()||'—';
  return <span className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-cyan-500/15 text-cyan-300 ${sizes[size]} ${className}`}>{photo&&!failed?<><img src={photo} alt={`${firstName||''} ${lastName||''}`.trim()} onLoad={()=>setLoading(false)} onError={()=>{setFailed(true);setLoading(false)}} className="h-full w-full rounded-full object-cover"/>{loading&&<span className="absolute inset-0 animate-pulse rounded-full bg-slate-700"/>}</>:<span className="flex h-full w-full items-center justify-center rounded-full font-semibold">{initials}</span>}</span>;
}
