import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import StudentAvatar from '../../components/StudentAvatar';

interface StudentRecord {
  id: string;
  uid?: string;
  firstName?: string;
  lastName?: string;
  apogee?: string;
  department?: string;
  program?: string;
  level?: string;
  photo?: string;
  rfidUID?: string | null;
  room?: string | null;
  status?: string;
  approved?: boolean;
}

interface AttendanceRecord {
  id: string;
  studentUid?: string;
  studentApogee?: string;
  rfidUID?: string;
  event?: 'ENTRY' | 'EXIT';
  room?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
}

interface ClassGroup {
  id: string;
  department: string;
  program: string;
  level: string;
  students: StudentRecord[];
}

interface ProfessorAssignments {
  department?: string;
  assignedClasses?: string[];
  assignedPrograms?: string[];
  assignedLevels?: string[];
}

const card = 'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20';
const fallback = {
  department: 'Département non renseigné',
  program: 'Filière non renseignée',
  level: 'Niveau non renseigné',
};
const clean = (value?: string) => value?.trim() || '';
const normalized = (value?: string) => clean(value).toLocaleLowerCase('fr');
const timestamp = (record: AttendanceRecord) => record.createdAt?.toDate?.().getTime() ?? ((record.createdAt?.seconds ?? 0) * 1000);

export default function ProfessorClassesPage() {
  const { userData } = useAuth();
  const professor = userData as typeof userData & ProfessorAssignments;
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceAvailable, setAttendanceAvailable] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsubscribeStudents = onSnapshot(collection(db, 'students'), snapshot => {
      const activeStudents = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as StudentRecord))
        .filter(student => normalized(student.status) === 'active' || student.approved === true);
      setStudents(activeStudents);
      setLoading(false);
    }, listenerError => {
      console.error('Professor classes students listener error:', listenerError);
      console.error('Professor classes loading error:', {
        code: listenerError.code,
        message: listenerError.message,
        error: listenerError,
      });
      setError(listenerError.message || 'Unable to load classes.');
      setLoading(false);
    });

    const attendanceQuery = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribeAttendance = onSnapshot(attendanceQuery, snapshot => {
      setAttendance(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as AttendanceRecord)));
      setAttendanceAvailable(true);
    }, listenerError => {
      console.error('Professor classes attendance listener error (attendance):', listenerError);
      setAttendance([]);
      setAttendanceAvailable(false);
    });
    return () => { unsubscribeStudents(); unsubscribeAttendance(); };
  }, [retryKey]);

  const latestPresence = useMemo(() => {
    const result = new Map<string, AttendanceRecord>();
    [...attendance].sort((a, b) => timestamp(b) - timestamp(a)).forEach(record => {
      [record.studentUid, record.studentApogee, record.rfidUID].filter(Boolean).forEach(identity => {
        const key = normalized(identity);
        if (!result.has(key)) result.set(key, record);
      });
    });
    return result;
  }, [attendance]);

  const allGroups = useMemo(() => {
    const groups = new Map<string, ClassGroup>();
    students.forEach(student => {
      const department = clean(student.department) || fallback.department;
      const program = clean(student.program) || fallback.program;
      const level = clean(student.level) || fallback.level;
      const id = `${normalized(department)}::${normalized(program)}::${normalized(level)}`;
      const group = groups.get(id) || { id, department, program, level, students: [] };
      group.students.push(student);
      groups.set(id, group);
    });
    return [...groups.values()].sort((a, b) => `${a.department}${a.program}${a.level}`.localeCompare(`${b.department}${b.program}${b.level}`, 'fr'));
  }, [students]);

  const groups = useMemo(() => {
    const assignments = professor?.assignedClasses?.map(normalized).filter(Boolean) || [];
    if (assignments.length) return allGroups.filter(group => assignments.some(value => group.id.includes(value) || normalized(`${group.department} ${group.program} ${group.level}`).includes(value)));
    if (clean(professor?.department)) return allGroups.filter(group => normalized(group.department) === normalized(professor.department));
    return allGroups;
  }, [allGroups, professor?.assignedClasses, professor?.department]);

  const hasSpecificAssignment = Boolean(professor?.assignedClasses?.length || clean(professor?.department));
  const statusFor = (student: StudentRecord) => {
    if (!attendanceAvailable) return 'Absent';
    const record = [student.uid, student.apogee, student.rfidUID || undefined].map(normalized).map(key => latestPresence.get(key)).find(Boolean);
    return record?.event === 'ENTRY' ? 'Present' : 'Absent';
  };

  return <div className="space-y-6">
    <div><p className="text-sm text-purple-400">Professor Portal</p><h1 className="text-3xl font-semibold text-white">My Classes</h1><p className="mt-1 text-sm text-slate-400">Live academic groups generated from active students.</p></div>
    {!hasSpecificAssignment && !loading && !error && <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">No specific classes are assigned to this professor yet. Displaying available classes.</div>}
    {!attendanceAvailable && <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Attendance is temporarily unavailable. Classes and students remain visible.</div>}
    {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"><span>{error}</span><button onClick={() => setRetryKey(value => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 px-3 py-2"><RefreshCw size={15}/>Retry</button></div>}
    {loading ? <div className={card}>Loading classes...</div> : !error && groups.length === 0 ? <div className={`${card} py-8 text-center text-sm text-slate-500`}>No classes are available yet.</div> : <div className="grid gap-5 lg:grid-cols-2">
      {groups.map(group => {
        const present = group.students.filter(student => statusFor(student) === 'Present').length;
        const absent = group.students.length - present;
        const percentage = group.students.length && attendanceAvailable ? Math.round(present / group.students.length * 100) : 0;
        const room = group.students.map(student => clean(student.room || '')).find(Boolean) || '—';
        const isExpanded = expanded === group.id;
        return <article key={group.id} className={`${card} ${isExpanded ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-start justify-between gap-3"><div className="rounded-2xl bg-purple-500/15 p-3 text-purple-400"><BookOpen/></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{group.students.length} students</span></div>
          <h2 className="mt-4 text-xl font-semibold text-white">{group.department}</h2><p className="text-sm text-purple-300">{group.program} · {group.level}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><p className="text-slate-400">Present<br/><span className="text-emerald-300">{present}</span></p><p className="text-slate-400">Absent<br/><span className="text-rose-300">{absent}</span></p><p className="text-slate-400">Attendance<br/><span className="text-white">{percentage}%</span></p><p className="text-slate-400">Room<br/><span className="text-white">{room}</span></p></div>
          <button onClick={() => setExpanded(isExpanded ? null : group.id)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm text-purple-200">View Students {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
          {isExpanded && <div className="mt-5 overflow-x-auto border-t border-slate-800 pt-5"><table className="w-full min-w-[950px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Photo','First Name','Last Name','Apogee','Department','Program','Level','Current Status','RFID Status'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{group.students.map(student => {const currentStatus = statusFor(student); return <tr key={student.id} className="border-t border-slate-800 text-slate-300"><td className="px-3 py-3"><StudentAvatar photo={student.photo} firstName={student.firstName} lastName={student.lastName} size="sm"/></td><td className="px-3 py-3 text-white">{student.firstName || '—'}</td><td className="px-3 py-3 text-white">{student.lastName || '—'}</td><td className="px-3 py-3">{student.apogee || student.id}</td><td className="px-3 py-3">{group.department}</td><td className="px-3 py-3">{group.program}</td><td className="px-3 py-3">{group.level}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 ${currentStatus === 'Present' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{currentStatus}</span></td><td className="px-3 py-3">{student.rfidUID ? <span className="text-cyan-300">Assigned</span> : <span className="text-slate-500">Not assigned</span>}</td></tr>;})}</tbody></table></div>}
        </article>;
      })}
    </div>}
  </div>;
}
