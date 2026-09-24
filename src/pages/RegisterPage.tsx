import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProfileImageUpload from '../components/ProfileImageUpload';
import { useAuth } from '../contexts/AuthContext';
import type { Student } from '../types';
import SmartCampusLogo from '../components/SmartCampusLogo';

const departments = ['Physique','Chimie','Informatique','Mathématiques'];
const programsByDepartment: Record<string,string[]> = { Physique:['Électronique Embarquée','Énergies Renouvelables','Systèmes de Télécommunication'], Chimie:[], Informatique:[], Mathématiques:[] };
const levels = ['Master 1','Master 2'];
const fieldClass = 'w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500/50';

export default function RegisterPage() {
  const [form, setForm] = useState({ firstName:'',lastName:'',email:'',password:'',phone:'',apogee:'',department:'',program:'',level:'' });
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({...form,[e.target.name]:e.target.value,...(e.target.name==='department'?{program:''}:{})});

  function friendlyError(err: unknown) {
    const value = err as { code?: string; message?: string };
    if (value.code === 'auth/email-already-in-use') return 'This email is already registered.';
    if (value.code === 'auth/weak-password') return 'Password must contain at least 6 characters.';
    if (value.code === 'auth/invalid-email') return 'Invalid email address.';
    if (value.code === 'permission-denied') return 'Firestore permission denied.';
    return value.message || 'Registration failed. Please try again.';
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.apogee || !form.department || !form.level || (programsByDepartment[form.department]?.length>0&&!form.program)) { setError('Please fill in all required fields.'); return; }
    if (form.password.length < 6) { setError('Password must contain at least 6 characters.'); return; }
    setLoading(true);
    try {
      const student: Partial<Student> = {...form, photo:''};
      const result = await register(form.email, form.password, student, image);
      console.log('STEP 7 - Redirecting');
      navigate('/registration-pending',{replace:true,state:{registrationWarning:result.warning}});
    } catch (err) { setError(friendlyError(err)); } finally { setLoading(false); }
  }

  const fields: Array<[string,string,string,boolean]> = [['firstName','First Name','text',true],['lastName','Last Name','text',true],['email','University Email','email',true],['password','Password','password',true],['phone','Phone','tel',false],['apogee','Apogee Number','text',true]];
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.2),_transparent_50%),_#020617] px-4 py-8"><motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/85 p-8 shadow-2xl shadow-slate-950/40">
    <div className="relative mb-6 flex flex-col items-center gap-3 text-center"><button type="button" onClick={()=>navigate('/login')} aria-label="Back to sign in" className="absolute left-0 top-1 rounded-2xl border border-slate-700 bg-slate-950/80 p-2 text-slate-300"><ArrowLeft size={20}/></button><SmartCampusLogo size="lg"/><div><p className="text-sm text-cyan-400">Student Registration</p><h2 className="text-xl font-semibold text-white">Create Your Account</h2></div></div>
    {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
    <form onSubmit={submit} className="space-y-6"><div className="grid gap-4 md:grid-cols-2">
      {fields.map(([name,label,type,required])=><label key={name} className="block text-sm text-slate-400">{label}{required?' *':''}<input className={`${fieldClass} mt-2`} name={name} type={type} value={form[name as keyof typeof form]} onChange={change} required={required} disabled={loading}/></label>)}
      <label className="block text-sm text-slate-400">Department / Filière *<select className={`${fieldClass} mt-2`} name="department" value={form.department} onChange={change} required disabled={loading}><option value="">Select department</option>{departments.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label className="block text-sm text-slate-400">Program {programsByDepartment[form.department]?.length?'*':''}<select className={`${fieldClass} mt-2`} name="program" value={form.program} onChange={change} required={Boolean(programsByDepartment[form.department]?.length)} disabled={loading||!form.department||!programsByDepartment[form.department]?.length}><option value="">{!form.department?'Select department first':programsByDepartment[form.department]?.length?'Select program':'No program available'}</option>{(programsByDepartment[form.department]||[]).map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label className="block text-sm text-slate-400">Study Level *<select className={`${fieldClass} mt-2`} name="level" value={form.level} onChange={change} required disabled={loading}><option value="">Select level</option>{levels.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <div className="md:col-span-2"><ProfileImageUpload file={image} onChange={setImage} onError={setError} disabled={loading}/></div>
    </div><button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{loading?<><Loader2 size={18} className="animate-spin"/>Creating account...</>:'Register'}</button>
    <p className="text-center text-sm text-slate-400">Already have an account? <button type="button" onClick={()=>navigate('/login')} className="font-medium text-cyan-400">Sign In</button></p></form>
  </motion.div></div>;
}
