import { useEffect, useState } from 'react';
import smartCampusLogo from '../assets/smart-campus-logo.png';

export type SmartCampusLogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  compact?: boolean;
  className?: string;
};

const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14', xl: 'h-20 w-20' };

export default function SmartCampusLogo({ size = 'md', showText = false, compact = false, className = '' }: SmartCampusLogoProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), []);
  const imageClass = `${sizes[size]} shrink-0 rounded-xl object-contain select-none`;
  return <div className={`inline-flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'} ${className}`}>
    {failed ? <span role="img" aria-label="Smart Campus 360 logo" className={`${imageClass} flex items-center justify-center bg-cyan-500/15 font-bold text-cyan-300`}>SC</span> : <img src={smartCampusLogo} alt="Smart Campus 360 logo" className={imageClass} draggable={false} onError={() => setFailed(true)}/>} 
    {showText && <span className="min-w-0"><span className="block truncate font-semibold text-white">Smart Campus</span>{!compact&&<span className="hidden truncate text-xs text-slate-400 sm:block">Smart Campus 360</span>}</span>}
  </div>;
}
