import { useEffect, useState, type ReactNode } from 'react';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Activity, Bell, BookOpen, Clock, Download, FileText, Search, UserCheck, Users, Wifi, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Professor } from '../../types';
import ProfessorStudentsPage from './ProfessorStudentsPage';
import ProfessorProfilePage from './ProfessorProfilePage';
import ProfessorClassesPage from './ProfessorClassesPage';
import LiveProfessorDashboard from './LiveProfessorDashboard';
import ProfessorAttendancePage from './ProfessorAttendancePage';

type Row = Record<string, any> & { id: string };

const card = 'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20';
const input = 'rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500';
const button = 'inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 transition hover:border-purple-500 hover:text-white';

function useCollection(name: string) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => onSnapshot(collection(db, name), s => setRows(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(`${name} listener`, e)), [name]);
  return rows;
}

function val(row: Row | undefined, ...keys: string[]) {
  for (const key of keys) if (row?.[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  return '';
}

function textId(value: unknown) { return String(value ?? '').trim().toLowerCase(); }
function dateText(value: any) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '—';
}
function timeText(value: any) {
  if (typeof value === 'string') return value;
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function useProfessorData() {
  const { currentUser, userData } = useAuth();
  const professor = userData as Professor;
  const courses = useCollection('courseAssignments');
  const classes = useCollection('classes');
  const students = useCollection('students');
  const attendance = useCollection('attendance');
  const scans = attendance;
  const devices = useCollection('devices');
  const sensors = useCollection('sensors');
  const notifications = useCollection('notifications');
  const professorIds = new Set([currentUser?.uid, professor?.id, professor?.employeeId, professor?.email].map(textId).filter(Boolean));
  const explicit = new Set([...(professor?.subjects ?? []), ...((professor as any)?.courseIds ?? []), ...((professor as any)?.assignedCourses ?? [])].map(textId));
  const mine = (r: Row) => [val(r, 'professorId', 'professorUid', 'teacherId', 'teacherUid', 'teacher', 'professorEmail')].some(x => professorIds.has(textId(x))) || explicit.has(textId(r.id)) || explicit.has(textId(val(r, 'code', 'name', 'course')));
  const myCourses = courses.filter(mine);
  const courseIds = new Set(myCourses.flatMap(c => [c.id, val(c, 'code', 'name')]).map(textId));
  const myClasses = classes.filter(c => mine(c) || courseIds.has(textId(val(c, 'courseId', 'course', 'courseCode'))));
  const classIds = new Set(myClasses.flatMap(c => [c.id, val(c, 'classroomId', 'classroom', 'room'), val(c, 'groupId', 'group')]).map(textId));
  const myStudents = students.filter(s => {
    const refs = [val(s, 'classId', 'classroomId', 'classroom', 'room'), val(s, 'courseId', 'course'), val(s, 'groupId', 'group', 'studentGroup')];
    const arrays = [...(s.classIds ?? []), ...(s.courseIds ?? []), ...(s.groups ?? [])];
    return [...refs, ...arrays].some(x => classIds.has(textId(x)) || courseIds.has(textId(x)));
  });
  const studentIds = new Set(myStudents.flatMap(s => [s.id, val(s, 'uid'), val(s, 'apogee')]).map(textId));
  const myAttendance = attendance.filter(a => studentIds.has(textId(val(a, 'studentId', 'studentUid', 'apogee'))) || courseIds.has(textId(val(a, 'courseId', 'course'))) || classIds.has(textId(val(a, 'classroomId', 'classroom', 'room'))));
  const myNotifications = notifications.filter(n => !val(n, 'userId', 'recipientId', 'role') || professorIds.has(textId(val(n, 'userId', 'recipientId'))) || textId(val(n, 'role')) === 'professor');
  return { professor, myCourses, myClasses, myStudents, myAttendance, scans, devices, sensors, myNotifications };
}

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-purple-400">Professor Portal</p><h1 className="text-3xl font-semibold text-white">{title}</h1><p className="mt-1 text-sm text-slate-400">{subtitle}</p></div>{action}</div>;
}
function Metric({ label, value, icon, tone = 'text-purple-400 bg-purple-500/15' }: { label: string; value: ReactNode; icon: ReactNode; tone?: string }) {
  return <div className={card}><div className="flex items-center gap-3"><div className={`rounded-2xl p-3 ${tone}`}>{icon}</div><div><p className="text-sm text-slate-400">{label}</p><p className="text-2xl font-semibold text-white">{value}</p></div></div></div>;
}
function Empty({ children = 'No records found.' }: { children?: ReactNode }) { return <div className="py-8 text-center text-sm text-slate-500">{children}</div>; }
function status(a: Row) { return String(val(a, 'status', 'attendanceStatus') || 'Present'); }

function exportRows(rows: Row[], kind: 'xlsx' | 'csv' | 'pdf') {
  const clean = rows.map(({ id, ...r }) => ({ ID: id, ...r }));
  if (kind === 'xlsx') { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean), 'Attendance'); XLSX.writeFile(wb, 'professor-attendance.xlsx'); }
  if (kind === 'csv') { const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(clean)); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'professor-attendance.csv'; a.click(); URL.revokeObjectURL(a.href); }
  if (kind === 'pdf') { const pdf = new jsPDF({ orientation: 'landscape' }); pdf.setFontSize(16); pdf.text('Professor attendance report', 12, 14); pdf.setFontSize(8); rows.slice(0, 55).forEach((r, i) => pdf.text(`${val(r, 'studentName', 'name', 'apogee')} | ${status(r)} | ${dateText(val(r, 'date', 'createdAt'))} | ${timeText(val(r, 'entryTime'))}`, 12, 24 + i * 4)); pdf.save('professor-attendance.pdf'); }
}

export function ProfessorDashboard(){return <LiveProfessorDashboard/>}

export function LegacyPortalDashboard() {
  const d = useProfessorData();
  const current = d.myClasses[0] ?? d.myCourses[0];
  const present = d.myAttendance.filter(a => textId(status(a)) === 'present').length;
  const absent = d.myAttendance.filter(a => textId(status(a)) === 'absent').length;
  const late = d.myAttendance.filter(a => textId(status(a)) === 'late').length;
  const percentage = d.myAttendance.length ? Math.round((present / d.myAttendance.length) * 100) : 0;
  return <div className="space-y-6"><Header title={`Welcome, ${d.professor?.firstName ?? 'Professor'}`} subtitle="Live overview of your classes, attendance and connected classroom." action={<button className={button} onClick={() => exportRows(d.myAttendance, 'xlsx')}><Download size={16}/>Export attendance</button>}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Students present" value={present} icon={<UserCheck size={20}/>} tone="text-emerald-400 bg-emerald-500/15"/><Metric label="Absent students" value={absent} icon={<XCircle size={20}/>} tone="text-rose-400 bg-rose-500/15"/><Metric label="Late students" value={late} icon={<Clock size={20}/>} tone="text-amber-400 bg-amber-500/15"/><Metric label="Attendance" value={`${percentage}%`} icon={<Activity size={20}/>} /></div>
    <div className="grid gap-6 xl:grid-cols-3"><section className={`${card} xl:col-span-2`}><h2 className="text-xl font-semibold text-white">Current session</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="text-xs uppercase text-slate-500">Course</p><p className="mt-1 text-white">{val(current, 'course', 'name', 'title') || 'No active course'}</p></div><div><p className="text-xs uppercase text-slate-500">Classroom</p><p className="mt-1 text-white">{val(current, 'classroom', 'room', 'classroomName') || '—'}</p></div><div><p className="text-xs uppercase text-slate-500">Schedule</p><p className="mt-1 text-white">{val(current, 'schedule', 'timeSlot', 'startTime') || '—'}</p></div></div></section><section className={card}><h2 className="text-xl font-semibold text-white">Connected systems</h2><div className="mt-4 space-y-3"><p className="flex justify-between text-sm text-slate-300"><span className="flex gap-2"><Wifi size={17}/>ESP32 status</span><span className="text-emerald-400">{d.devices.filter(x => textId(val(x,'status')) === 'online').length}/{d.devices.length} online</span></p><p className="flex justify-between text-sm text-slate-300"><span className="flex gap-2"><Activity size={17}/>Sensors status</span><span className="text-cyan-400">{d.sensors.filter(x => textId(val(x,'status')) !== 'offline').length}/{d.sensors.length} active</span></p></div></section></div>
    <section className={card}><h2 className="text-xl font-semibold text-white">Latest RFID scans</h2><div className="mt-4 space-y-2">{d.scans.slice(0,6).map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm"><span className="text-white">{val(s,'studentName','name') || 'Unknown card'}</span><span className="font-mono text-purple-300">{val(s,'rfidUID','uid')}</span><span className="text-slate-400">{timeText(val(s,'scannedAt','createdAt','timestamp'))}</span></div>)}{!d.scans.length && <Empty/>}</div></section></div>;
}

export function ProfessorClasses(){return <ProfessorClassesPage/>}

export function LegacyProfessorClasses() {
  const d = useProfessorData(); const rows = d.myClasses.length ? d.myClasses : d.myCourses;
  return <div className="space-y-6"><Header title="My Classes" subtitle="Courses and groups assigned to your professor account."/><div className="grid gap-5 lg:grid-cols-2">{rows.map(c => <article key={c.id} className={card}><div className="flex items-start justify-between"><div className="rounded-2xl bg-purple-500/15 p-3 text-purple-400"><BookOpen/></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{val(c,'code','courseCode') || c.id}</span></div><h2 className="mt-4 text-xl font-semibold text-white">{val(c,'course','name','title')}</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p className="text-slate-400">Classroom<br/><span className="text-slate-100">{val(c,'classroom','room') || '—'}</span></p><p className="text-slate-400">Student group<br/><span className="text-slate-100">{val(c,'group','studentGroup') || '—'}</span></p><p className="text-slate-400">Department<br/><span className="text-slate-100">{val(c,'department') || d.professor?.department || '—'}</span></p><p className="text-slate-400">Study level<br/><span className="text-slate-100">{val(c,'level','studyLevel') || '—'}</span></p><p className="text-slate-400">Schedule<br/><span className="text-slate-100">{val(c,'schedule','timeSlot') || '—'}</span></p><p className="text-slate-400">Registered<br/><span className="text-slate-100">{val(c,'registeredStudents','studentCount') || d.myStudents.length}</span></p></div></article>)}{!rows.length && <Empty>No assigned classes are available yet.</Empty>}</div></div>;
}

export function LegacyProfessorAttendance() {
  const d = useProfessorData(); const [filters,setFilters]=useState({date:'',room:'',course:'',department:'',level:''});
  const rows=d.myAttendance.filter(a => (!filters.date || dateText(val(a,'date','createdAt')) === new Date(`${filters.date}T00:00:00`).toLocaleDateString()) && (!filters.room || textId(val(a,'room','classroom')).includes(textId(filters.room))) && (!filters.course || textId(val(a,'course','courseName')).includes(textId(filters.course))) && (!filters.department || textId(val(a,'department')).includes(textId(filters.department))) && (!filters.level || textId(val(a,'level','studyLevel')).includes(textId(filters.level))));
  return <div className="space-y-6"><Header title="Attendance" subtitle="Live attendance records for your assigned courses."/><div className={`${card} grid gap-3 sm:grid-cols-2 xl:grid-cols-5`}>{Object.entries(filters).map(([k,v]) => <input key={k} type={k==='date'?'date':'text'} value={v} placeholder={k[0].toUpperCase()+k.slice(1)} onChange={e=>setFilters({...filters,[k]:e.target.value})} className={input}/>)}</div><div className="flex flex-wrap gap-2"><button className={button} onClick={()=>exportRows(rows,'xlsx')}>Excel</button><button className={button} onClick={()=>exportRows(rows,'csv')}>CSV</button><button className={button} onClick={()=>exportRows(rows,'pdf')}>PDF</button><button className={button} onClick={()=>window.print()}>Print</button></div><div className={`${card} overflow-x-auto`}><table className="w-full min-w-[1050px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Student','First name','Last name','Apogee','Entry','Exit','Duration','Status','RFID UID'].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{rows.map(a=><tr key={a.id} className="border-t border-slate-800"><td className="px-3 py-3"><img className="h-9 w-9 rounded-xl object-cover bg-slate-800" src={val(a,'photo','studentPhoto') || `https://ui-avatars.com/api/?name=${encodeURIComponent(val(a,'studentName','firstName'))}&background=1e293b&color=c4b5fd`} /></td><td className="px-3 py-3 text-white">{val(a,'firstName')}</td><td className="px-3 py-3 text-white">{val(a,'lastName')}</td><td className="px-3 py-3">{val(a,'apogee')}</td><td className="px-3 py-3">{timeText(val(a,'entryTime'))}</td><td className="px-3 py-3">{timeText(val(a,'exitTime'))}</td><td className="px-3 py-3">{val(a,'duration') || '—'}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-800 px-2 py-1">{status(a)}</span></td><td className="px-3 py-3 font-mono text-purple-300">{val(a,'rfidUID','uid')}</td></tr>)}</tbody></table>{!rows.length&&<Empty/>}</div></div>;
}

export function ProfessorAttendance(){
  return <ProfessorAttendancePage/>;
  /* Legacy raw RFID event view retained below for reference. */
  const [attendanceRecords,setAttendanceRecords]=useState<Row[]>([]),[attendanceError,setAttendanceError]=useState(''),[loading,setLoading]=useState(true);
  const [filters,setFilters]=useState({search:'',department:'',program:'',level:'',room:'',event:'',date:''});
  useEffect(()=>{const attendanceQuery=query(collection(db,'attendance'),orderBy('createdAt','desc'),limit(100));const unsubscribe=onSnapshot(attendanceQuery,snapshot=>{const data=snapshot.docs.map(item=>({id:item.id,...item.data()}));console.log('Professor attendance snapshot size:',snapshot.size);console.log('Professor attendance records:',data);setAttendanceRecords(data);setAttendanceError('');setLoading(false);},error=>{console.error('Professor attendance listener error:',error);setAttendanceError(error.message);setLoading(false);});return()=>unsubscribe();},[]);
  const rows=attendanceRecords.filter(record=>{const search=textId(filters.search);const created=record.createdAt?.toDate?.();return(!search||textId(`${record.studentName||''} ${record.studentApogee||''}`).includes(search))&&(!filters.department||record.department===filters.department)&&(!filters.program||record.program===filters.program)&&(!filters.level||record.level===filters.level)&&(!filters.room||record.room===filters.room)&&(!filters.event||record.event===filters.event)&&(!filters.date||created?.toISOString().slice(0,10)===filters.date);});
  const options=(key:'department'|'program'|'level'|'room')=>Array.from(new Set(attendanceRecords.map(record=>String(record[key]||'')).filter(Boolean))).sort();
  return <div className="space-y-6"><Header title="Attendance" subtitle="Live RFID attendance scans from Firestore." action={<span className="rounded-full bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">Live synchronization active</span>}/><div className={`${card} grid gap-3 sm:grid-cols-2 xl:grid-cols-7`}><input className={input} value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder="Student or Apogee"/>{(['department','program','level','room'] as const).map(key=><select key={key} className={input} value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">All {key}</option>{options(key).map(option=><option key={option}>{option}</option>)}</select>)}<select className={input} value={filters.event} onChange={e=>setFilters({...filters,event:e.target.value})}><option value="">All events</option><option value="ENTRY">ENTRY</option><option value="EXIT">EXIT</option></select><input className={input} type="date" value={filters.date} onChange={e=>setFilters({...filters,date:e.target.value})}/></div><div className="flex flex-wrap gap-2"><button className={button} onClick={()=>exportRows(rows,'xlsx')}>Excel</button><button className={button} onClick={()=>exportRows(rows,'csv')}>CSV</button><button className={button} onClick={()=>exportRows(rows,'pdf')}>PDF</button><button className={button} onClick={()=>window.print()}>Print</button></div>{loading?<div className={`${card} py-12 text-center text-slate-400`}>Loading attendance records...</div>:attendanceError?<div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">Unable to load attendance records.</div>:<div className={`${card} overflow-x-auto`}><table className="w-full min-w-[1200px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Student','Apogee','Department','Program','Level','Event','Room','Date','Time','RFID UID'].map(header=><th key={header} className="px-3 py-3">{header}</th>)}</tr></thead><tbody>{rows.map(record=>{const created=record.createdAt?.toDate?.();const entry=record.event==='ENTRY';return <tr key={record.id} className="border-t border-slate-800 text-slate-300"><td className="px-3 py-3 font-medium text-white">{record.studentName||'-'}</td><td className="px-3 py-3">{record.studentApogee||'-'}</td><td className="px-3 py-3">{record.department||'-'}</td><td className="px-3 py-3">{record.program||'-'}</td><td className="px-3 py-3">{record.level||'-'}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 ${entry?'bg-emerald-500/15 text-emerald-300':'bg-orange-500/15 text-orange-300'}`}>{entry?'Entry':record.event==='EXIT'?'Exit':record.event||'-'}</span></td><td className="px-3 py-3">{record.room||'-'}</td><td className="px-3 py-3">{created?created.toLocaleDateString():'-'}</td><td className="px-3 py-3">{created?created.toLocaleTimeString():'-'}</td><td className="px-3 py-3 font-mono text-purple-300">{record.rfidUID||'-'}</td></tr>;})}</tbody></table>{attendanceRecords.length===0?<Empty>No records found.</Empty>:rows.length===0?<Empty>No matching records.</Empty>:null}</div>}</div>;
}

export function LegacyProfessorStudents() {
  const d=useProfessorData();
  const [students,setStudents]=useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [search,setSearch]=useState('');
  const [department,setDepartment]=useState('');
  const [level,setLevel]=useState('');
  const [presence,setPresence]=useState('');
  const [selected,setSelected]=useState<Row>();
  const [reason,setReason]=useState('');

  useEffect(() => {
    const activeQuery = query(collection(db, 'students'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(activeQuery, snapshot => {
      const data = snapshot.docs.map(studentDoc => ({ id: studentDoc.id, ...studentDoc.data() }));
      console.log('Students loaded:', data);
      setStudents(data);
      setLoadError('');
      setLoading(false);
    }, error => {
      console.error('Firestore error:', error);
      setLoadError(error.message || 'Unable to load students from Firestore.');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const departments = Array.from(new Set(students.map(s=>String(val(s,'department'))).filter(Boolean))).sort();
  const levels = Array.from(new Set(students.map(s=>String(val(s,'level','studyLevel'))).filter(Boolean))).sort();
  const rows=students.filter(s=>{
    const matchesSearch=textId(`${val(s,'firstName')} ${val(s,'lastName')} ${val(s,'apogee')}`).includes(textId(search));
    const matchesDepartment=!department||String(val(s,'department'))===department;
    const matchesLevel=!level||String(val(s,'level','studyLevel'))===level;
    const isPresent=val(s,'present')===true||textId(val(s,'status','attendanceStatus'))==='present';
    const matchesPresence=!presence||(presence==='present'?isPresent:!isPresent);
    return matchesSearch&&matchesDepartment&&matchesLevel&&matchesPresence;
  });
  async function justify(){if(!selected||!reason.trim())return; await addDoc(collection(db,'absenceJustifications'),{studentId:selected.id,apogee:val(selected,'apogee'),professorId:d.professor.id,reason:reason.trim(),status:'submitted',createdAt:serverTimestamp()}); setReason('');setSelected(undefined);}
  return <div className="space-y-6"><Header title="Students" subtitle="Active students loaded live from Firestore."/><div className={`${card} grid gap-3 sm:grid-cols-2 xl:grid-cols-4`}><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-500" size={18}/><input className={`${input} w-full pl-10`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or apogee"/></div><select className={input} value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All departments</option>{departments.map(v=><option key={v}>{v}</option>)}</select><select className={input} value={level} onChange={e=>setLevel(e.target.value)}><option value="">All levels</option>{levels.map(v=><option key={v}>{v}</option>)}</select><select className={input} value={presence} onChange={e=>setPresence(e.target.value)}><option value="">All attendance statuses</option><option value="present">Present</option><option value="absent">Absent</option></select></div>{loading?<div className={`${card} py-12 text-center text-slate-400`}><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-purple-500"/>Loading students…</div>:loadError?<div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300"><p className="font-medium">Students could not be loaded.</p><p className="mt-1 text-sm text-rose-300/80">{loadError}</p></div>:<div className="grid gap-4 lg:grid-cols-2">{rows.map(s=>{const history=d.myAttendance.filter(a=>[s.id,val(s,'uid'),val(s,'apogee')].map(textId).includes(textId(val(a,'studentId','studentUid','apogee'))));const pct=history.length?Math.round(history.filter(a=>textId(status(a))==='present').length/history.length*100):Number(val(s,'attendance','attendancePercentage')||0);const isPresent=val(s,'present')===true;const rfid=val(s,'rfidUID');const initials=`${String(val(s,'firstName')).charAt(0)}${String(val(s,'lastName')).charAt(0)}`.toUpperCase();return <article key={s.id} className={card}><div className="flex items-center gap-4">{val(s,'photo')?<img className="h-14 w-14 rounded-2xl object-cover bg-slate-800" src={val(s,'photo')} alt=""/>:<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 font-semibold text-purple-300">{initials||'—'}</div>}<div className="min-w-0"><h2 className="truncate font-semibold text-white">{val(s,'firstName')} {val(s,'lastName')}</h2><p className="text-sm text-slate-400">Apogee {val(s,'apogee')}</p><p className="text-xs text-slate-500">{val(s,'department')||'—'} · {val(s,'level')||'—'}</p></div><div className="ml-auto text-right"><p className="text-xl font-semibold text-purple-300">{pct}%</p><p className="text-xs text-slate-500">attendance</p></div></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4 text-xs"><span className={`rounded-full px-2.5 py-1 ${isPresent?'bg-emerald-500/15 text-emerald-300':'bg-rose-500/15 text-rose-300'}`}>{isPresent?'Present':'Absent'}</span><span className={`rounded-full px-2.5 py-1 ${rfid?'bg-cyan-500/15 text-cyan-300':'bg-slate-800 text-slate-400'}`}>{rfid?'RFID Assigned':'No RFID'}</span><button className={`${button} ml-auto`} onClick={()=>setSelected(s)}>Add justification</button></div></article>})}</div>}{!loading&&!loadError&&!rows.length&&<Empty>No active students found.</Empty>}{selected&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className={`${card} w-full max-w-lg`}><h2 className="text-xl font-semibold text-white">Absence justification</h2><p className="mt-1 text-sm text-slate-400">{val(selected,'firstName')} {val(selected,'lastName')}</p><textarea className={`${input} mt-4 min-h-28 w-full`} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Enter the justification details"/><div className="mt-4 flex justify-end gap-2"><button className={button} onClick={()=>setSelected(undefined)}>Cancel</button><button className="rounded-xl bg-purple-600 px-4 py-2 text-sm text-white" onClick={justify}>Save justification</button></div></div></div>}</div>;
}

export function ProfessorStudents() { return <ProfessorStudentsPage />; }

export function ProfessorReports(){const d=useProfessorData();return <div className="space-y-6"><Header title="Reports" subtitle="Generate attendance reports for your assigned classes."/><div className="grid gap-4 md:grid-cols-3"><Metric label="Attendance records" value={d.myAttendance.length} icon={<FileText/>}/><Metric label="Classes covered" value={d.myClasses.length} icon={<BookOpen/>}/><Metric label="Students covered" value={d.myStudents.length} icon={<Users/>}/></div><section className={card}><h2 className="text-xl font-semibold text-white">Export report</h2><p className="mt-1 text-sm text-slate-400">Exports are limited to attendance records you can access.</p><div className="mt-5 flex flex-wrap gap-2"><button className={button} onClick={()=>exportRows(d.myAttendance,'xlsx')}>Excel</button><button className={button} onClick={()=>exportRows(d.myAttendance,'csv')}>CSV</button><button className={button} onClick={()=>exportRows(d.myAttendance,'pdf')}>PDF</button><button className={button} onClick={()=>window.print()}>Print</button></div></section></div>}

export function ProfessorStatistics(){const d=useProfessorData();const counts=['Present','Absent','Late'].map(s=>d.myAttendance.filter(a=>textId(status(a))===textId(s)).length);const labels=d.myClasses.slice(0,7).map(c=>String(val(c,'course','name','title')||c.id));const values=labels.map((_,i)=>{const subset=d.myAttendance.filter(a=>textId(val(a,'course','courseName','courseId')).includes(textId(labels[i])));return subset.length?Math.round(subset.filter(a=>textId(status(a))==='present').length/subset.length*100):0});return <div className="space-y-6"><Header title="Statistics" subtitle="Real-time attendance performance across your classes."/><div className="grid gap-6 lg:grid-cols-2"><section className={card}><h2 className="mb-4 text-lg font-semibold text-white">Attendance distribution</h2><div className="mx-auto max-w-sm"><Doughnut data={{labels:['Present','Absent','Late'],datasets:[{data:counts,backgroundColor:['#10b981','#f43f5e','#f59e0b']}]}}/></div></section><section className={card}><h2 className="mb-4 text-lg font-semibold text-white">Attendance by course</h2><Bar data={{labels,datasets:[{label:'Attendance %',data:values,backgroundColor:'#a855f7'}]}} options={{scales:{y:{beginAtZero:true,max:100}}}}/></section></div></div>}

export function ProfessorNotifications(){const d=useProfessorData();return <div className="space-y-6"><Header title="Notifications" subtitle="Class updates, attendance alerts and campus information."/><section className={card}><div className="space-y-3">{d.myNotifications.map(n=><div key={n.id} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4"><div className="rounded-xl bg-purple-500/15 p-2 text-purple-400"><Bell size={18}/></div><div><h2 className="font-medium text-white">{val(n,'title')||'Notification'}</h2><p className="mt-1 text-sm text-slate-400">{val(n,'message','description')}</p><p className="mt-2 text-xs text-slate-600">{dateText(val(n,'createdAt','timestamp'))}</p></div></div>)}{!d.myNotifications.length&&<Empty/>}</div></section></div>}

export function ProfessorProfile(){return <ProfessorProfilePage/>}
