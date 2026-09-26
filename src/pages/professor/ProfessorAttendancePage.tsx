import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Clock, Download, Eye, Printer, Square, Plus } from 'lucide-react';
import { auth, db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  academicValuesMatch,
  cleanAcademicValue,
  hasCompleteSessionAcademics,
  isStudentEligibleForSession,
  normalizeAcademicValue,
} from '../../../backend/academic-normalization.mjs';

type Row = Record<string, any> & { id: string };
type ReportRow = { student: Row; record?: Row; status: 'Present' | 'Absent' };
type AcademicFilter = { department: string; program: string; level: string; status: string };

const card = 'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20';
const input = 'rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500';
const button = 'inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 transition hover:border-purple-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
const morocco = 'Africa/Casablanca';
const apiBase = 'https://smartcampus360-production.up.railway.app';
const emptyFilter: AcademicFilter = { department: '', program: '', level: '', status: '' };
const emptyForm = { department: '', program: '', level: '', room: '' };

const value = (row: Row | undefined, ...keys: string[]) => keys.map(key => row?.[key]).find(item => item !== undefined && item !== null && item !== '') ?? '';
const date = (input: any) => {
  const result = input?.toDate?.() ?? (input ? new Date(input) : undefined);
  return result && !Number.isNaN(result.getTime()) ? new Intl.DateTimeFormat('en-GB', { timeZone: morocco }).format(result) : '—';
};
const time = (input: any) => {
  if (typeof input === 'string') return input;
  const result = input?.toDate?.() ?? (input ? new Date(input) : undefined);
  return result && !Number.isNaN(result.getTime()) ? new Intl.DateTimeFormat('en-GB', { timeZone: morocco, hour: '2-digit', minute: '2-digit' }).format(result) : '—';
};
const academicOptions = (values: unknown[]) => {
  const unique = new Map<string, string>();
  values.map(cleanAcademicValue).filter(Boolean).forEach(item => {
    const key = normalizeAcademicValue(item);
    if (!unique.has(key)) unique.set(key, item);
  });
  return [...unique.values()].sort((left, right) => left.localeCompare(right, 'en'));
};
const rowIdentity = (row: Row) => [row.uid, row.id, row.apogee].map(normalizeAcademicValue).filter(Boolean);
const sharesStudentIdentity = (student: Row, record: Row) => {
  const identities = new Set(rowIdentity(student));
  return [record.studentUid, record.studentId, record.studentApogee, record.apogee]
    .map(normalizeAcademicValue).some(identity => identity && identities.has(identity));
};
const recordForStudent = (student: Row, records: Row[]) => records.find(record => sharesStudentIdentity(student, record));

function buildReportRows(session: Row, students: Row[], records: Row[]): ReportRow[] {
  if (hasCompleteSessionAcademics(session)) {
    return students.filter(student => isStudentEligibleForSession(student, session)).map(student => {
      const record = recordForStudent(student, records);
      return { student, record, status: record ? 'Present' : 'Absent' };
    });
  }

  // Legacy sessions have no reliable roster dimensions. Show recorded attendees only; do not infer an absent roster from filiere.
  return records.map(record => {
    const student = students.find(candidate => sharesStudentIdentity(candidate, record)) ?? {
      id: String(value(record, 'studentUid', 'studentId', 'studentApogee', 'id')),
      firstName: value(record, 'firstName') || value(record, 'studentName'),
      lastName: value(record, 'lastName'),
      apogee: value(record, 'studentApogee', 'apogee'),
      department: value(record, 'department'),
      program: value(record, 'program'),
      level: value(record, 'level'),
    } as Row;
    return { student, record, status: 'Present' };
  });
}

function matchesReportFilters(row: ReportRow, filter: AcademicFilter, search: string): boolean {
  const student = row.student;
  const searchText = normalizeAcademicValue(`${value(student, 'firstName')} ${value(student, 'lastName')} ${value(student, 'apogee')}`);
  return (!search || searchText.includes(normalizeAcademicValue(search)))
    && (!filter.department || academicValuesMatch(student.department, filter.department))
    && (!filter.program || academicValuesMatch(student.program, filter.program))
    && (!filter.level || academicValuesMatch(student.level, filter.level))
    && (!filter.status || row.status === filter.status);
}

function sessionStatusLabel(status: string) {
  if (status === 'En cours') return 'Active';
  if (status === 'Terminée') return 'Completed';
  return status;
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <div className="flex items-center gap-3 rounded-2xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm">
    <Clock size={18} className="text-purple-300" />
    <div><p className="font-semibold text-white">{new Intl.DateTimeFormat('en-GB', { timeZone: morocco }).format(now)}</p>
      <p className="font-mono text-purple-200">{new Intl.DateTimeFormat('en-GB', { timeZone: morocco, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)}</p>
    </div>
  </div>;
}

export default function ProfessorAttendancePage() {
  const { currentUser, userData } = useAuth();
  const [sessions, setSessions] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [records, setRecords] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AcademicFilter>(emptyFilter);
  const [form, setForm] = useState(emptyForm);
  const [rooms, setRooms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const professorId = currentUser?.uid || '';

  useEffect(() => {
    if (!professorId) return;
    return onSnapshot(query(collection(db, 'attendanceSessions'), where('professorId', '==', professorId)), snapshot => {
      setSessions(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Row))
        .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0)));
    }, listenerError => setError(listenerError.message));
  }, [professorId]);

  useEffect(() => onSnapshot(collection(db, 'students'), snapshot => {
    setStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Row)));
  }, listenerError => setError(listenerError.message)), []);

  useEffect(() => onSnapshot(collection(db, 'classrooms'), snapshot => {
    const available = snapshot.docs.map(item => String(value({ id: item.id, ...item.data() }, 'name', 'room', 'classroom')).trim()).filter(Boolean);
    setRooms([...new Set(available.length ? available : ['Amphi A'])].sort());
  }, listenerError => { setRooms(['Amphi A']); setError(listenerError.message); }), []);

  const active = sessions.find(session => session.status === 'En cours') || null;
  const selectedFromSnapshot = selected ? sessions.find(session => session.id === selected.id) || selected : null;
  const displayed = selectedFromSnapshot || active;

  useEffect(() => {
    if (!displayed) { setRecords([]); return; }
    return onSnapshot(query(collection(db, 'attendance'), where('sessionId', '==', displayed.id)), snapshot => {
      setRecords(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Row)));
    }, listenerError => setError(listenerError.message));
  }, [displayed?.id]);

  const departments = useMemo(() => academicOptions(students.map(student => student.department)), [students]);
  const programsForForm = useMemo(() => academicOptions(students
    .filter(student => academicValuesMatch(student.department, form.department)).map(student => student.program)), [students, form.department]);
  const levelsForForm = useMemo(() => academicOptions(students
    .filter(student => academicValuesMatch(student.department, form.department) && academicValuesMatch(student.program, form.program))
    .map(student => student.level)), [students, form.department, form.program]);

  const reportRows = useMemo(() => displayed ? buildReportRows(displayed, students, records) : [], [displayed, students, records]);
  const filteredRows = useMemo(() => reportRows.filter(row => matchesReportFilters(row, filter, search)), [reportRows, filter, search]);
  const filterPrograms = useMemo(() => academicOptions(students
    .filter(student => !filter.department || academicValuesMatch(student.department, filter.department)).map(student => student.program)), [students, filter.department]);
  const filterLevels = useMemo(() => academicOptions(students.filter(student =>
    (!filter.department || academicValuesMatch(student.department, filter.department))
    && (!filter.program || academicValuesMatch(student.program, filter.program))).map(student => student.level)), [students, filter.department, filter.program]);
  async function sessionRequest(path: string, body: Record<string, unknown>) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Please sign in again to manage attendance sessions.');
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'The session request failed.');
    return result;
  }

  async function start() {
    if (!form.department || !form.program || !form.level || !form.room || !professorId || active) return;
    setBusy(true);
    setError('');
    try {
      const now = new Date();
      await sessionRequest('/api/sessions/start', {
        date: new Intl.DateTimeFormat('en-GB', { timeZone: morocco }).format(now),
        startTime: new Intl.DateTimeFormat('en-GB', { timeZone: morocco, hour: '2-digit', minute: '2-digit' }).format(now),
        department: form.department,
        program: form.program,
        level: form.level,
        filiere: form.program,
        niveau: form.level,
        room: form.room,
        professorName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || currentUser?.email || 'Professor',
      });
    } catch (requestError: any) {
      setError(requestError.message || 'Could not start the session.');
    } finally { setBusy(false); }
  }

  async function finish(session: Row | null = active) {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await sessionRequest('/api/sessions/finish', {
        sessionId: session.id,
        endTime: new Intl.DateTimeFormat('en-GB', { timeZone: morocco, hour: '2-digit', minute: '2-digit' }).format(new Date()),
      });
    } catch (requestError: any) {
      setError(requestError.message || 'Could not end the session.');
    } finally { setBusy(false); }
  }

  async function pdf(session: Row) {
    const snapshot = session.id === displayed?.id ? null : await getDocs(query(collection(db, 'attendance'), where('sessionId', '==', session.id)));
    const sessionRecords = snapshot ? snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Row)) : records;
    const rows = buildReportRows(session, students, sessionRecords).filter(row => matchesReportFilters(row, filter, search));
    const pdfDocument = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const isCanonical = hasCompleteSessionAcademics(session);
    const presentCount = rows.filter(row => row.status === 'Present').length;
    const academicDetails = isCanonical
      ? [`Department: ${session.department}`, `Program: ${session.program}`, `Level: ${session.level}`]
      : ['Academic classification: Legacy fields (not inferred)', `Legacy filiere field: ${session.filiere || 'Not recorded'}`, `Legacy niveau field: ${session.niveau || 'Not recorded'}`];

    pdfDocument.setFillColor(88, 28, 135);
    pdfDocument.rect(0, 0, 297, 24, 'F');
    pdfDocument.setTextColor(255);
    pdfDocument.setFontSize(18);
    pdfDocument.text('SMART CAMPUS 360', 14, 12);
    pdfDocument.setFontSize(11);
    pdfDocument.text('Professor Attendance Report', 14, 19);
    pdfDocument.setTextColor(20);
    pdfDocument.setFontSize(14);
    pdfDocument.text('ATTENDANCE SESSION', 14, 35);
    pdfDocument.setFontSize(10);
    pdfDocument.text([
      `Date: ${session.date || date(session.createdAt)}`,
      `Start time: ${session.startTime || '—'}`,
      `End time: ${session.endTime || '—'}`,
      ...academicDetails,
      `Professor: ${session.professorName || '—'}`,
      `Room: ${session.room || 'Room unavailable'}`,
    ], 14, 43);
    pdfDocument.text(isCanonical
      ? [`Enrolled students: ${rows.length}`, `Present: ${presentCount}`, `Absent: ${rows.length - presentCount}`]
      : [`Recorded attendees: ${rows.length}`, 'An enrolled roster is unavailable for this legacy session.'], 165, 43);
    autoTable(pdfDocument, {
      startY: 82,
      head: [['No.', 'Full name', 'Apogee', 'Department', 'Program', 'Level', 'Entry', 'Exit', 'Status']],
      body: rows.map((row, index) => [
        index + 1,
        `${value(row.student, 'firstName')} ${value(row.student, 'lastName')}`.trim() || value(row.record, 'studentName') || '—',
        value(row.student, 'apogee') || '—',
        value(row.student, 'department') || '—',
        value(row.student, 'program') || '—',
        value(row.student, 'level') || '—',
        row.record ? time(value(row.record, 'entryTime', 'createdAt')) : '—',
        row.record ? time(value(row.record, 'exitTime')) : '—',
        row.status,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [88, 28, 135] },
      didDrawPage: (page: { pageNumber: number }) => {
        pdfDocument.setFontSize(8);
        pdfDocument.text(`Generated on: ${date(new Date())} ${time(new Date())} · Page ${page.pageNumber}`, 14, 205);
      },
    });
    pdfDocument.save(`session_${session.date || session.id}.pdf`);
  }

  function print(session: Row) {
    setSelected(session);
    window.setTimeout(() => window.print(), 0);
  }

  return <div className="space-y-6 print:space-y-0">
    <style>{`@media print { aside, nav, button, .no-print { display:none!important } body { background:white!important } main { padding:0!important } .print-report { display:block!important; color:#111!important; border:0!important; box-shadow:none!important } }`}</style>
    <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-purple-400">Professor Portal</p><h1 className="text-3xl font-semibold text-white">Attendance sessions</h1><p className="mt-1 text-sm text-slate-400">RFID attendance is grouped by session; sessions never mix dates.</p></div>
      <LiveClock />
    </div>

    <section className={`${card} no-print`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-purple-300">ACTIVE SESSION</p>
          {active ? <div className="mt-3 space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <p>Date: <b className="text-white">{active.date || date(active.createdAt)}</b></p>
              <p>Start time: <b className="text-white">{active.startTime || '—'}</b></p>
              <p>Status: <b className="text-emerald-300">Active</b></p>
              <p>Room: <b className="text-white">{active.room || 'Room unavailable'}</b></p>
              {hasCompleteSessionAcademics(active) ? <>
                <p>Department: <b className="text-white">{active.department}</b></p>
                <p>Program: <b className="text-white">{active.program}</b></p>
                <p>Level: <b className="text-white">{active.level}</b></p>
              </> : <p className="text-amber-300 sm:col-span-3">This active session uses legacy academic fields. End it and create a new session with Department, Program, Level, and Room before scanning. Scans are disabled for legacy sessions.</p>}
            </div>
          </div> : <p className="mt-2 text-sm text-slate-400">No active session. Select a department, program, level, and room to start.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="session-department">Department</label>
          <select id="session-department" className={input} value={form.department} disabled={Boolean(active) || busy} required onChange={event => setForm(current => ({ ...current, department: event.target.value, program: '', level: '' }))}>
            <option value="">Department *</option>{departments.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="session-program">Program</label>
          <select id="session-program" className={input} value={form.program} disabled={Boolean(active) || busy || !form.department} required onChange={event => setForm(current => ({ ...current, program: event.target.value, level: '' }))}>
            <option value="">Program / Filière *</option>{programsForForm.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="session-level">Level</label>
          <select id="session-level" className={input} value={form.level} disabled={Boolean(active) || busy || !form.program} required onChange={event => setForm(current => ({ ...current, level: event.target.value }))}>
            <option value="">Level *</option>{levelsForForm.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="session-room">Room</label>
          <select id="session-room" className={input} value={form.room} disabled={Boolean(active) || busy} required onChange={event => setForm(current => ({ ...current, room: event.target.value }))}>
            <option value="">Room *</option>{rooms.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className={button} disabled={busy || Boolean(active) || !form.department || !form.program || !form.level || !form.room} onClick={start}><Plus size={16} />New session</button>
          <button className={button} disabled={busy || !active} onClick={() => void finish()}><Square size={15} />End session</button>
        </div>
      </div>
    </section>

    {error && <div className="no-print rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

    {displayed && <section className={`${card} print-report`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{selected ? 'Session details' : 'Current session attendance'}</h2>
          {hasCompleteSessionAcademics(displayed) ? <p className="text-sm text-slate-400">{displayed.department} · {displayed.program} · {displayed.level} · {displayed.room || 'Room unavailable'} · {displayed.date || date(displayed.createdAt)}</p>
            : <p className="text-sm text-amber-300">Legacy session · academic classification is not inferred · {displayed.room || 'Room unavailable'} · {displayed.date || date(displayed.createdAt)}</p>}
        </div>
        <div className="no-print flex gap-2"><button className={button} onClick={() => void pdf(displayed)}><Download size={15} />PDF</button><button className={button} onClick={() => print(displayed)}><Printer size={15} />Print</button></div>
      </div>

      <div className="no-print mt-4 grid gap-2 md:grid-cols-5">
        <input className={input} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search students" />
        <select className={input} value={filter.department} onChange={event => setFilter(current => ({ ...current, department: event.target.value, program: '', level: '' }))}>
          <option value="">All departments</option>{departments.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={input} value={filter.program} onChange={event => setFilter(current => ({ ...current, program: event.target.value, level: '' }))}>
          <option value="">All programs</option>{filterPrograms.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={input} value={filter.level} onChange={event => setFilter(current => ({ ...current, level: event.target.value }))}>
          <option value="">All levels</option>{filterLevels.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={input} value={filter.status} onChange={event => setFilter(current => ({ ...current, status: event.target.value }))}>
          <option value="">All statuses</option><option value="Present">Present</option><option value="Absent">Absent</option>
        </select>
      </div>

      {hasCompleteSessionAcademics(displayed)
        ? <p className="mt-4 text-sm text-slate-300">Filtered roster: <b>{filteredRows.length}</b> enrolled · <b className="text-emerald-300">{filteredRows.filter(row => row.status === 'Present').length}</b> present · <b className="text-rose-300">{filteredRows.filter(row => row.status === 'Absent').length}</b> absent</p>
        : <p className="mt-4 text-sm text-amber-300">Historical attendance records shown: {filteredRows.length}. The enrolled roster and absent count are unavailable for this legacy session.</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr>{['No.', 'Full name', 'Apogee', 'Department', 'Program', 'Level', 'Entry', 'Exit', 'Status'].map(item => <th key={item} className="px-3 py-3">{item}</th>)}</tr></thead>
          <tbody>{filteredRows.map((row, index) => <tr key={`${row.student.id}-${row.record?.id || 'absent'}`} className="border-t border-slate-800">
            <td className="px-3 py-3">{index + 1}</td>
            <td className="px-3 py-3 font-medium text-white">{`${value(row.student, 'firstName')} ${value(row.student, 'lastName')}`.trim() || value(row.record, 'studentName')}</td>
            <td className="px-3 py-3">{value(row.student, 'apogee') || '—'}</td>
            <td className="px-3 py-3">{value(row.student, 'department') || '—'}</td>
            <td className="px-3 py-3">{value(row.student, 'program') || '—'}</td>
            <td className="px-3 py-3">{value(row.student, 'level') || '—'}</td>
            <td className="px-3 py-3">{row.record ? time(value(row.record, 'entryTime', 'createdAt')) : '—'}</td>
            <td className="px-3 py-3">{row.record ? time(value(row.record, 'exitTime')) : '—'}</td>
            <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 ${row.status === 'Present' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{row.status}</span></td>
          </tr>)}</tbody>
        </table>
        {!filteredRows.length && <p className="py-8 text-center text-sm text-slate-500">No matching attendance rows.</p>}
      </div>
    </section>}

    <section className={`${card} no-print`}>
      <h2 className="text-xl font-semibold text-white">Session history</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1150px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr>{['Date', 'Room', 'Department', 'Program', 'Level', 'Start', 'End', 'Status', 'Actions'].map(item => <th key={item} className="px-3 py-3">{item}</th>)}</tr></thead>
          <tbody>{sessions.map(session => {
            const canonical = hasCompleteSessionAcademics(session);
            return <tr key={session.id} className="border-t border-slate-800">
              <td className="px-3 py-3">{session.date || date(session.createdAt)}</td>
              <td className="px-3 py-3">{session.room || 'Room unavailable'}</td>
              <td className="px-3 py-3">{canonical ? session.department : 'Not recorded'}</td>
              <td className="px-3 py-3">{canonical ? session.program : `Legacy filiere: ${session.filiere || 'Not recorded'}`}</td>
              <td className="px-3 py-3">{canonical ? session.level : `Legacy niveau: ${session.niveau || 'Not recorded'}`}</td>
              <td className="px-3 py-3">{session.startTime || '—'}</td>
              <td className="px-3 py-3">{session.endTime || '—'}</td>
              <td className="px-3 py-3">{sessionStatusLabel(session.status)}</td>
              <td className="flex gap-2 px-3 py-3">
                {session.status === 'En cours' && <button className={button} disabled={busy} onClick={() => void finish(session)}><Square size={14} />End session</button>}
                <button className={button} onClick={() => setSelected(session)}><Eye size={14} />View</button>
                <button className={button} onClick={() => void pdf(session)}><Download size={14} />PDF</button>
                <button className={button} onClick={() => print(session)}><Printer size={14} />Print</button>
              </td>
            </tr>;
          })}</tbody>
        </table>
        {!sessions.length && <p className="py-8 text-center text-sm text-slate-500">No sessions created.</p>}
      </div>
    </section>
  </div>;
}
