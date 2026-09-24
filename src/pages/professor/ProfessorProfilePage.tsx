import { useEffect, useState } from 'react';
import { Camera, Edit3, Loader2, Save, X } from 'lucide-react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../firebase';
import StudentAvatar from '../../components/StudentAvatar';
import ProfileImageUpload from '../../components/ProfileImageUpload';
import { uploadProfileImage } from '../../services/cloudinary';

interface ProfessorProfileData {
  uid:string; email:string; firstName:string; lastName:string; phone:string; department:string; employeeId:string;
  assignedClasses:string[]|number; assignedStudents:string[]|number; photo:string; role:string; status:string;
}
const empty:ProfessorProfileData={uid:'',email:'',firstName:'',lastName:'',phone:'',department:'',employeeId:'',assignedClasses:0,assignedStudents:0,photo:'',role:'professor',status:'active'};
const panel='rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20';
const input='w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-purple-500';
const count=(value:string[]|number)=>Array.isArray(value)?value.length:Number(value||0);

export default function ProfessorProfilePage(){
  const {loading:authLoading}=useAuth();
  const [profile,setProfile]=useState<ProfessorProfileData|null>(null),[loading,setLoading]=useState(true),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false);
  const [form,setForm]=useState({firstName:'',lastName:'',phone:'',department:''}),[photoFile,setPhotoFile]=useState<File|null>(null),[imageError,setImageError]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');

  useEffect(()=>{
    if(authLoading)return;
    const uid=auth.currentUser?.uid;
    if(!uid){setLoading(false);return;}
    console.log('Professor UID:',uid);
    console.log('Reading professor document:',`professors/${uid}`);
    const userRef=doc(db,'users',uid),professorRef=doc(db,'professors',uid);
    let unsubscribe=()=>{};let cancelled=false;
    (async()=>{try{
      const [userSnapshot,professorSnapshot]=await Promise.all([getDoc(userRef),getDoc(professorRef)]);
      const user=userSnapshot.data()||{};
      if(!professorSnapshot.exists())await setDoc(professorRef,{uid,email:String(user.email||auth.currentUser?.email||''),firstName:String(user.firstName||''),lastName:String(user.lastName||''),phone:'',department:'',employeeId:'',assignedClasses:0,assignedStudents:0,photo:'',role:'professor',status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      if(cancelled)return;
      unsubscribe=onSnapshot(professorRef,snapshot=>{const professional=snapshot.data()||{};const merged={...empty,...user,...professional,uid} as ProfessorProfileData;setProfile(merged);setLoading(false);},snapshotError=>{console.error('Professor profile error:',snapshotError.code,snapshotError.message);setError(snapshotError.message);setLoading(false);});
    }catch(loadError){const failure=loadError as {code?:string;message?:string};console.error('Professor profile error:',failure.code,failure.message);setError(failure.message||'Unable to load professor profile.');setLoading(false);}})();
    return()=>{cancelled=true;unsubscribe();};
  },[authLoading]);

  function beginEdit(){if(!profile)return;setForm({firstName:profile.firstName,lastName:profile.lastName,phone:profile.phone,department:profile.department});setPhotoFile(null);setImageError('');setError('');setMessage('');setEditing(true);}
  async function save(){const uid=auth.currentUser?.uid;if(!profile||!uid)return;if(!form.firstName.trim()||!form.lastName.trim()){setError('First name and last name are required.');return;}setSaving(true);setError('');
    try{let photo=profile.photo;if(photoFile)photo=await uploadProfileImage(photoFile);const updatedAt=serverTimestamp();await updateDoc(doc(db,'professors',uid),{firstName:form.firstName.trim(),lastName:form.lastName.trim(),phone:form.phone.trim(),department:form.department.trim(),photo,updatedAt});await updateDoc(doc(db,'users',uid),{firstName:form.firstName.trim(),lastName:form.lastName.trim(),updatedAt});setMessage('Profile updated successfully.');setEditing(false);setPhotoFile(null);}catch(updateError){const failure=updateError as {code?:string;message?:string};console.error('Professor profile update error:',failure.code,failure.message);setError(failure.message||'Professor profile update failed.');}finally{setSaving(false);}}

  if(loading)return <div className={`${panel} flex items-center justify-center gap-3 text-slate-400`}><Loader2 className="animate-spin"/>Loading professor profile...</div>;
  if(!profile)return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">{error||'Professor profile unavailable.'}</div>;
  return <div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-purple-400">Professor Portal</p><h1 className="text-3xl font-semibold text-white">Profile</h1><p className="mt-1 text-sm text-slate-400">Your identity and professional assignment overview.</p></div><button onClick={beginEdit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white"><Edit3 size={17}/>Edit Profile</button></div>
  {message&&<div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}{error&&<div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
  <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><section className={`${panel} text-center`}><StudentAvatar photo={profile.photo} firstName={profile.firstName} lastName={profile.lastName} size="xl" className="mx-auto"/><h2 className="mt-4 text-2xl font-semibold text-white">{profile.firstName} {profile.lastName}</h2><p className="capitalize text-purple-400">{profile.role}</p><span className="mt-3 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-sm capitalize text-emerald-300">{profile.status}</span><button onClick={beginEdit} className="mx-auto mt-5 flex items-center gap-2 text-sm text-cyan-300"><Camera size={16}/>Change Photo</button></section>
  <section className={panel}><h2 className="text-xl font-semibold text-white">Professional information</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[['Email',profile.email],['Employee ID',profile.employeeId||'—'],['Department',profile.department||'—'],['Assigned classes',count(profile.assignedClasses)],['Assigned students',count(profile.assignedStudents)],['Phone',profile.phone||'—']].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"><dt className="text-xs uppercase text-slate-500">{label}</dt><dd className="mt-1 text-slate-100">{value}</dd></div>)}</dl><p className="mt-5 text-xs text-slate-500">Employee ID, assignments, role, and status are managed by the administration.</p></section></div>
  {editing&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className={`${panel} max-h-[90vh] w-full max-w-2xl overflow-y-auto`}><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-white">Edit Profile</h2><p className="text-sm text-slate-400">Update your personal information and photo.</p></div><button onClick={()=>setEditing(false)} className="rounded-xl border border-slate-700 p-2 text-slate-300"><X size={18}/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{(['firstName','lastName','phone','department'] as const).map(name=><label key={name} className="text-sm capitalize text-slate-400">{name.replace(/([A-Z])/g,' $1')}<input value={form[name]} onChange={e=>setForm({...form,[name]:e.target.value})} className={`${input} mt-2`}/></label>)}<div className="sm:col-span-2"><ProfileImageUpload file={photoFile} onChange={setPhotoFile} onError={setImageError} disabled={saving}/>{imageError&&<p className="mt-2 text-sm text-rose-300">{imageError}</p>}</div></div><div className="mt-6 flex justify-end gap-3"><button onClick={()=>setEditing(false)} disabled={saving} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancel</button><button onClick={save} disabled={saving||Boolean(imageError)} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm text-white disabled:opacity-50">{saving?<Loader2 size={17} className="animate-spin"/>:<Save size={17}/>}Save Changes</button></div></div></div>}</div>;
}
