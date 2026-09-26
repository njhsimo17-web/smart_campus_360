import { useMemo, useState } from 'react';
import { Activity, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLiveAttendance, type LiveAttendanceRecord } from '../hooks/useLiveAttendance';
import { academicValuesMatch, cleanAcademicValue, normalizeAcademicValue } from '../../backend/academic-normalization.mjs';

const panel = 'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20';
const control = 'rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500';
const dateValue = (record: LiveAttendanceRecord) => record.createdAt?.toDate();
const exportRow = (record: LiveAttendanceRecord) => ({
  Student: record.studentName,
  Apogee: record.studentApogee,
  Department: record.department,
  Program: record.program,
  Level: record.level,
  Event: record.event,
  Room: record.room,
  'RFID UID': record.rfidUID,
  Device: record.deviceId,
  Date: dateValue(record)?.toLocaleDateString() || '-',
  Time: dateValue(record)?.toLocaleTimeString() || '-',
});
function options(values: string[]) {
  const unique = new Map<string, string>();
  values.map(cleanAcademicValue).filter(Boolean).forEach(value => {
    const key = normalizeAcademicValue(value);
    if (!unique.has(key)) unique.set(key, value);
  });
  return [...unique.values()].sort((left, right) => left.localeCompare(right, 'en'));
}

export default function LiveAttendancePage({ portal }: { portal: 'Admin' | 'Professor' }) {
  const { records, loading, error } = useLiveAttendance();
  const [filters, setFilters] = useState({ search: '', department: '', program: '', level: '', room: '', event: '', date: '' });
  const departments = useMemo(() => options(records.map(record => record.department)), [records]);
  const programs = useMemo(() => options(records.filter(record =>
    !filters.department || academicValuesMatch(record.department, filters.department)).map(record => record.program)), [records, filters.department]);
  const levels = useMemo(() => options(records.filter(record =>
    (!filters.department || academicValuesMatch(record.department, filters.department))
    && (!filters.program || academicValuesMatch(record.program, filters.program))).map(record => record.level)), [records, filters.department, filters.program]);
  const rooms = useMemo(() => options(records.map(record => record.room)), [records]);
  const filtered = useMemo(() => records.filter(record => {
    const search = normalizeAcademicValue(filters.search);
    const date = dateValue(record);
    return (!search || normalizeAcademicValue(`${record.studentName} ${record.studentApogee}`).includes(search))
      && (!filters.department || academicValuesMatch(record.department, filters.department))
      && (!filters.program || academicValuesMatch(record.program, filters.program))
      && (!filters.level || academicValuesMatch(record.level, filters.level))
      && (!filters.room || academicValuesMatch(record.room, filters.room))
      && (!filters.event || record.event === filters.event)
      && (!filters.date || date?.toISOString().slice(0, 10) === filters.date);
  }), [records, filters]);

  function excel() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(filtered.map(exportRow)), 'Attendance');
    XLSX.writeFile(book, `attendance_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  function csv() {
    const text = '\uFEFF' + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(filtered.map(exportRow)));
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function pdf() {
    const document = new jsPDF({ orientation: 'landscape' });
    document.text('Attendance report', 14, 15);
    autoTable(document, {
      startY: 20,
      head: [Object.keys(exportRow(filtered[0] || ({} as LiveAttendanceRecord)))],
      body: filtered.map(record => Object.values(exportRow(record))),
    });
    document.save(`attendance_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-cyan-400">{portal} Portal</p><h1 className="text-3xl font-semibold text-white">Attendance</h1><p className="mt-1 text-sm text-slate-400">Latest RFID attendance events from Firestore.</p></div>
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"><Activity size={16} className="animate-pulse" />Live synchronization active</span>
    </div>

    <section className={`${panel} grid gap-3 sm:grid-cols-2 xl:grid-cols-7`}>
      <div className="relative"><Search size={17} className="absolute left-3 top-2.5 text-slate-500" /><input className={`${control} w-full pl-9`} placeholder="Student or Apogee" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} /></div>
      <select className={control} value={filters.department} onChange={event => setFilters(current => ({ ...current, department: event.target.value, program: '', level: '' }))}><option value="">All Departments</option>{departments.map(option => <option key={option} value={option}>{option}</option>)}</select>
      <select className={control} value={filters.program} onChange={event => setFilters(current => ({ ...current, program: event.target.value, level: '' }))}><option value="">All Programs</option>{programs.map(option => <option key={option} value={option}>{option}</option>)}</select>
      <select className={control} value={filters.level} onChange={event => setFilters(current => ({ ...current, level: event.target.value }))}><option value="">All Levels</option>{levels.map(option => <option key={option} value={option}>{option}</option>)}</select>
      <select className={control} value={filters.room} onChange={event => setFilters(current => ({ ...current, room: event.target.value }))}><option value="">All Rooms</option>{rooms.map(option => <option key={option} value={option}>{option}</option>)}</select>
      <select className={control} value={filters.event} onChange={event => setFilters(current => ({ ...current, event: event.target.value }))}><option value="">All Events</option><option value="ENTRY">ENTRY</option><option value="EXIT">EXIT</option></select>
      <input type="date" className={control} value={filters.date} onChange={event => setFilters(current => ({ ...current, date: event.target.value }))} />
    </section>

    <div className="flex flex-wrap gap-2">
      <button onClick={excel} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"><Download size={15} />Excel</button>
      <button onClick={csv} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"><Download size={15} />CSV</button>
      <button onClick={pdf} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"><Download size={15} />PDF</button>
    </div>

    {loading ? <div className={`${panel} py-12 text-center text-slate-400`}><span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-500" />Loading attendance records...</div>
      : error ? <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">Unable to load attendance records.</div>
        : <section className={`${panel} overflow-x-auto`}>
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr>{['Student', 'Apogee', 'Department', 'Program', 'Level', 'Event', 'Room', 'RFID UID', 'Device', 'Date', 'Time'].map(header => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead>
            <tbody>{filtered.map(record => {
              const created = dateValue(record);
              const entry = record.event === 'ENTRY';
              return <tr key={record.id} className="border-t border-slate-800 text-slate-300">
                <td className="px-3 py-3 font-medium text-white">{record.studentName || '-'}</td><td className="px-3 py-3">{record.studentApogee || '-'}</td>
                <td className="px-3 py-3">{record.department || '-'}</td><td className="px-3 py-3">{record.program || '-'}</td><td className="px-3 py-3">{record.level || '-'}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 ${entry ? 'bg-emerald-500/15 text-emerald-300' : 'bg-orange-500/15 text-orange-300'}`}>{entry ? 'Entry' : record.event === 'EXIT' ? 'Exit' : record.event || '-'}</span></td>
                <td className="px-3 py-3">{record.room || '-'}</td><td className="px-3 py-3 font-mono text-cyan-300">{record.rfidUID || '-'}</td><td className="px-3 py-3">{record.deviceId || '-'}</td>
                <td className="px-3 py-3">{created?.toLocaleDateString() || '-'}</td><td className="px-3 py-3">{created?.toLocaleTimeString() || '-'}</td>
              </tr>;
            })}</tbody>
          </table>
          {!filtered.length && <p className="py-10 text-center text-sm text-slate-500">No attendance records found.</p>}
        </section>}
  </div>;
}
