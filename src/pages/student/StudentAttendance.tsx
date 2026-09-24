import { motion } from 'framer-motion';
import { CalendarRange, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStudentAttendance } from '../../hooks/useStudentAttendance';
import type { Student } from '../../types';

export default function StudentAttendance() {
  const { currentUser, userData } = useAuth();
  const student = userData as Student;
  const { records, latest, loading, error } = useStudentAttendance(currentUser?.uid);
  const present = latest?.event === 'ENTRY';
  const entries = records.filter(record => record.event === 'ENTRY').length;
  const attendance = records.length ? Math.round(entries / records.length * 100) : Number(student?.attendance || 0);
  return <div className="space-y-6">
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"><div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-400"><CalendarRange size={20}/></div><div><h1 className="text-2xl font-semibold text-white">My Attendance</h1><p className="text-sm text-slate-400">Live RFID attendance history.</p></div></div></div>
    <div className="grid gap-4 md:grid-cols-3">{[
      ['Attendance %', `${attendance}%`, 'text-cyan-400'], ['Current Status', present ? 'Present' : 'Absent', present ? 'text-emerald-400' : 'text-rose-400'], ['Current Room', present ? latest?.room || '—' : '—', 'text-purple-400']
    ].map(([label,value,tone])=><motion.div key={label} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p></motion.div>)}</div>
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"><h2 className="mb-4 text-xl font-semibold text-white">Recent Attendance History</h2>
      {loading?<p className="text-slate-400">Loading attendance...</p>:error?<p className="text-rose-300">{error}</p>:records.length===0?<p className="text-slate-500">No attendance records found.</p>:<div className="space-y-3">{records.map(record=>{const date=record.createdAt?.toDate?.();const isEntry=record.event==='ENTRY';return <div key={record.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"><div className="flex items-center gap-3"><div className={`rounded-full p-2 ${isEntry?'bg-emerald-500/15 text-emerald-400':'bg-rose-500/15 text-rose-400'}`}>{isEntry?<CheckCircle2 size={16}/>:<XCircle size={16}/>}</div><div><p className="font-medium text-white">{date?.toLocaleString()||'—'}</p><p className="text-sm text-slate-400">{record.room||'—'}</p></div></div><span className={isEntry?'text-emerald-400':'text-rose-400'}>{isEntry?'Entry':'Exit'}</span></div>})}</div>}
    </div>
  </div>;
}
