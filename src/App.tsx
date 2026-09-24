import { useMemo, useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { BellRing, QrCode, Activity, AlertTriangle, CheckCircle2, ChevronRight, Download, Shield, Sparkles, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { StatCard } from './components/StatCard';
import { LiveTimeline } from './components/LiveTimeline';
import { RoomMap } from './components/RoomMap';
import RoleBasedSidebar from './components/RoleBasedSidebar';
import ProtectedRoute from './components/ProtectedRoute';
import StudentAvatar from './components/StudentAvatar';
import LiveAttendancePage from './components/LiveAttendancePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentProfileView from './pages/student/StudentProfile';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentNotifications from './pages/student/StudentNotifications';
import StudentSettings from './pages/student/StudentSettings';
import {
  ProfessorDashboard,
  ProfessorClasses,
  ProfessorAttendance,
  ProfessorStudents,
  ProfessorReports,
  ProfessorStatistics,
  ProfessorNotifications,
  ProfessorProfile,
} from './pages/professor/ProfessorPortal';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClassesPage from './pages/admin/AdminClassesPage';
import PendingRegistrations from './pages/admin/PendingRegistrations';
import RFIDManagement from './pages/admin/RFIDManagement';
import RoleAccessPage from './pages/RoleAccessPage';
import ProfessorStudentProfilePage from './pages/professor/ProfessorStudentProfilePage';
import {
  dashboardStats,
  students,
  attendanceRecords,
  classrooms,
  esp32Devices,
  sensors,
  notifications,
  rfidRecords,
  liveEvents,
  roomSeats,
  aiInsights,
  type StudentProfile,
} from './data/mock';
import { db } from './firebase.ts';
import { collection, doc, getDoc, setDoc, serverTimestamp, onSnapshot, query, deleteDoc } from 'firebase/firestore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

function Sidebar() {
  return <RoleBasedSidebar />;
}

function PageHeader({ title, subtitle, badge, actions }: { title: string; subtitle: string; badge?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm text-cyan-400">Enterprise campus operations</p>
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {badge ? (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
            {badge}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StudentProfilePage({ student }: { student: StudentProfile }) {
  const firstName = student.firstName ?? 'Unknown';
  const lastName = student.lastName ?? '';
  const apogee = student.apogee ?? (student.id ?? '—');
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const department = student.department ?? '';
  const photo = student.photo ?? '';
  const attendance = typeof (student as any).attendance === 'number' ? (student as any).attendance : (student.attendance ?? 0);
  const recentActivity = Array.isArray((student as any).recentActivity) ? (student as any).recentActivity : (student.recentActivity ?? []);

  const handleExportAttendance = () => {
    const data = [{
      'Student Name': `${firstName} ${lastName}`,
      Apogee: apogee,
      RFID: getRfidUID(student) || '—',
      Email: student.email || '—',
      Department: department,
      'Current Room': student.room || '—',
      'Entry Time': student.entryTime || '—',
      'Exit Time': student.exitTime || '—',
      'Attendance %': attendance,
      Status: student.status || '—'
    }];
    exportToExcel(data, `${firstName}_${lastName}_attendance`);
  };

  const handleDownloadPDF = () => {
    const content = [
      `${firstName} ${lastName}`,
      `Apogee: ${apogee}`,
      `Email: ${student.email || '—'}`,
      `Department: ${department}`,
      `Room: ${student.room || '—'}`,
      `Entry Time: ${student.entryTime || '—'}`,
      `Exit Time: ${student.exitTime || '—'}`,
      `Attendance: ${attendance}%`,
      `Status: ${student.status || '—'}`
    ];
    exportToPDF('Student Profile', content, `${firstName}_${lastName}_profile`);
  };

  const handlePrintProfile = () => {
    const printContent = `
      <html>
        <head>
          <title>${firstName} ${lastName} - Student Profile</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; }
            .info { margin: 10px 0; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${firstName} ${lastName}</h1>
          <div class="info"><span class="label">Apogee:</span> ${apogee}</div>
          <div class="info"><span class="label">Email:</span> ${student.email || '—'}</div>
          <div class="info"><span class="label">Department:</span> ${department}</div>
          <div class="info"><span class="label">Room:</span> ${student.room || '—'}</div>
          <div class="info"><span class="label">Attendance:</span> ${attendance}%</div>
          <div class="info"><span class="label">Status:</span> ${student.status || '—'}</div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`${firstName} ${lastName}`.trim()} subtitle="Professional student profile with attendance history, QR profile, and room context." badge={apogee} />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Student overview" subtitle="Identity and current campus context" actions={<div className="flex gap-2"><button onClick={() => navigate(`/students/${apogee}/edit`)} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200">Edit</button><button onClick={() => setShowConfirm(true)} className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">Delete</button></div>}>
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <StudentAvatar photo={photo} firstName={firstName} lastName={lastName} size="xl" className="!h-24 !w-24 !text-2xl" />
              <div className="space-y-2">
                <p className="text-sm text-cyan-400">{department}</p>
                <h3 className="text-2xl font-semibold text-white">{firstName} {lastName}</h3>
                <p className="text-sm text-slate-400">Class: {student.studentClass ?? '—'}</p>
                {isPresent(student) ? <StatusPill state="Present" successText="Present" /> : <StatusPill state="Absent" successText="Absent" />}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="Apogee" value={apogee} />
              <InfoCard label="RFID UID" value={getRfidUID(student) || '—'} />
              <InfoCard label="Email" value={student.email ?? '—'} />
              <InfoCard label="Current room" value={student.room ?? '—'} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-400">Attendance %</p>
                <p className="text-lg font-semibold text-white">{attendance}%</p>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${attendance}%` }} />
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Quick actions" subtitle="Profile operations for administrators and staff">
            <div className="flex flex-wrap gap-3">
              <button onClick={handlePrintProfile} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">Print profile</button>
              <button onClick={handleDownloadPDF} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">Download PDF</button>
              <button onClick={() => notifyUnimplemented('View history')} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">View history</button>
              <button onClick={handleExportAttendance} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">Export attendance</button>
            </div>
          </SectionCard>
          <SectionCard title="QR access" subtitle="Campus badge and secure access token">
            <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                  <QrCode size={28} className="text-cyan-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Student QR</p>
                  <p className="text-sm text-slate-400">ID {apogee}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-center text-xs text-slate-400">
                <div className="grid grid-cols-3 gap-1">{Array.from({ length: 9 }).map((_, index) => <span key={index} className="h-2 w-2 rounded-full bg-cyan-400" />)}</div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Attendance timeline" subtitle="Entry, exit, and room activity history">
          <div className="space-y-3">
            {[
              { title: 'Entry detected', detail: `${student.entryTime ?? '—'} • ${student.room ?? '—'}`, tone: 'text-emerald-300' },
              { title: 'Exit logged', detail: `${student.exitTime ?? '—'} • ${student.room ?? '—'}`, tone: 'text-rose-300' },
              { title: 'Profile reviewed', detail: 'Campus portal accessed at 09:20', tone: 'text-cyan-300' },
            ].map((item) => (
              <div key={item.title} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm text-slate-400">{item.detail}</p>
                </div>
                <span className={`text-sm ${item.tone}`}>Live</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Recent activity" subtitle="Latest student actions in the smart campus platform">
          <ul className="space-y-3 text-sm text-slate-400">
            {recentActivity.length === 0 ? <li className="text-slate-500">No recent activity.</li> : recentActivity.map((item: string) => (
                <li key={item} className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3"><CheckCircle2 size={16} className="text-emerald-400" />{item}</li>
              ))}
          </ul>
        </SectionCard>
      </div>
        {showConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6">
              <h3 className="text-lg font-semibold text-white">Supprimer l'étudiant</h3>
              <p className="mt-2 text-sm text-slate-400">Voulez-vous vraiment supprimer cet étudiant ? Cette action est irréversible.</p>
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setShowConfirm(false)} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-200">Annuler</button>
                <button onClick={async () => {
                  try {
                    await deleteDoc(doc(db, 'students', apogee));
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    if (typeof window.showAppToast === 'function') window.showAppToast('Student deleted');
                    navigate('/students');
                  } catch (err) {
                    console.error('Delete failed', err);
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    if (typeof window.showAppToast === 'function') window.showAppToast('Failed to delete student.');
                    else window.alert('Failed to delete student.');
                  }
                }} className="rounded-2xl bg-rose-500 px-4 py-2 text-sm text-white">Supprimer</button>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  );
}

function SectionCard({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/30"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </motion.div>
  );
}

function StatusPill({ state, successText }: { state: string; successText?: string }) {
  const isGood = state === 'Online' || state === 'Active' || state === 'Present';
  const tone = isGood ? 'bg-emerald-500/15 text-emerald-300' : state === 'Warning' || state === 'Late' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300';
  return <span className={`rounded-full px-3 py-1 text-sm ${tone}`}>{successText ?? state}</span>;
}

function getRfidUID(student: StudentProfile) {
  return ((student as any).rfidUID ?? (student as any).rfid ?? '').toString();
}

function isPresent(student: StudentProfile) {
  const p = (student as any).present;
  if (typeof p === 'boolean') return p;
  return student.status === 'Present';
}

function getInitials(student: StudentProfile) {
  const a = `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim();
  const parts = a.split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  const initials = (parts[0][0] ?? '') + (parts[1]?.[0] ?? '');
  return initials.toUpperCase();
}

function notifyUnimplemented(action?: string) {
  try {
    // use non-blocking toast when available
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window.showAppToast === 'function') window.showAppToast(`${action ?? 'This feature'} n'est pas encore implémentée.`);
    else window.alert(`${action ?? 'This feature'} n'est pas encore implémentée.`);
  } catch (e) {
    console.warn('Unimplemented action:', action);
  }
}

function exportToExcel(data: any[], fileName: string) {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window.showAppToast === 'function') window.showAppToast(`Excel file "${fileName}" exported successfully.`);
  } catch (error) {
    console.error('Export to Excel failed:', error);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window.showAppToast === 'function') window.showAppToast('Export failed. Please try again.');
  }
}

function exportToCSV(data: any[], fileName: string) {
  try {
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window.showAppToast === 'function') window.showAppToast(`CSV file "${fileName}" exported successfully.`);
  } catch (error) {
    console.error('Export to CSV failed:', error);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window.showAppToast === 'function') window.showAppToast('Export failed. Please try again.');
  }
}

function exportToPDF(title: string, content: string[], fileName: string) {
  try {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 10, 10);
    
    doc.setFontSize(10);
    let yPosition = 20;
    content.forEach(line => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 10;
      }
      doc.text(line, 10, yPosition);
      yPosition += 5;
    });

    doc.save(`${fileName}.pdf`);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window.showAppToast === 'function') window.showAppToast(`PDF file "${fileName}" exported successfully.`);
  } catch (error) {
    console.error('Export to PDF failed:', error);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window.showAppToast === 'function') window.showAppToast('Export failed. Please try again.');
  }
}

function ToastRoot() {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  useEffect(() => {
    // expose a global helper to trigger toasts from non-hook code
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.showAppToast = (message: string) => {
      setToasts((t) => [...t, { id: Date.now(), msg: message }]);
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete window.showAppToast;
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts((t) => t.slice(1)), 3500);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((t) => (
        <div key={t.id} className="max-w-sm rounded-2xl bg-white/95 p-4 shadow-lg text-slate-900">
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function DashboardPage({ onSelectStudent, searchTerm, students }: { onSelectStudent: (student: StudentProfile) => void; searchTerm: string; students: StudentProfile[] }) {
  const filteredStudents = useMemo(() => students.filter((student) => `${student.firstName} ${student.lastName} ${student.apogee} ${getRfidUID(student)}`.toLowerCase().includes(searchTerm.toLowerCase())), [searchTerm, students]);

  return (
    <div className="space-y-6">
      <PageHeader title="Smart Campus Operations Center" subtitle="Unified IoT visibility for attendance, occupancy, RFID, and device health." badge="Real-time sync active" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            trend={item.trend}
            evolution={item.evolution}
            color={item.color}
            tooltip={item.tooltip}
            icon={<Activity size={18} />}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard title="Live room occupancy" subtitle="Animated seat overview with instant student recognition">
          <RoomMap seats={roomSeats} students={students} onSelect={onSelectStudent} />
        </SectionCard>

        <SectionCard title="Occupancy pulse" subtitle="Room readiness and alert conditions">
          <div className="space-y-4">
            {[
              { label: 'Capacity', value: '80 seats', color: 'bg-cyan-500' },
              { label: 'Current occupancy', value: '48 present', color: 'bg-emerald-500' },
              { label: 'Almost full', value: 'Amphi A', color: 'bg-amber-500' },
              { label: 'Critical alerts', value: '3 active', color: 'bg-rose-500' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <span className="text-sm text-slate-400">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className={`h-2 rounded-full ${item.color}`} style={{ width: item.label === 'Current occupancy' ? '60%' : item.label === 'Almost full' ? '92%' : item.label === 'Critical alerts' ? '25%' : '100%' }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Live activity" subtitle="RFID scans, room entry, and exit events appear instantly">
          <LiveTimeline events={liveEvents} />
        </SectionCard>

        <SectionCard title="Student presence" subtitle="Students currently inside the monitored rooms">
          <div className="space-y-3">
            {filteredStudents.slice(0, 4).map((student) => (
              <button key={student.id} onClick={() => onSelectStudent(student)} className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left transition hover:border-cyan-500/40 hover:bg-slate-800/70">
                <div>
                  <p className="font-medium text-white">{student.firstName} {student.lastName}</p>
                  <p className="text-sm text-slate-400">{student.apogee} • {student.room}</p>
                </div>
                  {isPresent(student) ? <StatusPill state="Present" successText="Present" /> : <StatusPill state="Absent" successText="Absent" />}
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function StudentsPage({ students, onSelectStudent, searchTerm }: { students: StudentProfile[]; onSelectStudent: (student: StudentProfile) => void; searchTerm: string }) {
  const filtered = useMemo(
    () =>
      students.filter((student) =>
        `${student.firstName} ${student.lastName} ${student.apogee} ${student.department} ${student.studentClass || ''} ${getRfidUID(student)}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, students],
  );

  const groupedStudents = useMemo(() => {
    const grouped = new Map<string, Map<string, StudentProfile[]>>();

    filtered.forEach((student) => {
      const department = student.department || 'Unassigned';
      const level = student.studentClass || 'Unknown';

      if (!grouped.has(department)) {
        grouped.set(department, new Map());
      }

      const levels = grouped.get(department)!;
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(student);
    });

    return Array.from(grouped.entries()).map(([department, levels]) => ({
      department,
      levels: Array.from(levels.entries()).map(([level, entries]) => ({ level, entries })),
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="Student directory"
          subtitle="Students are grouped by department and study level for a clearer academic view."
          badge={`${filtered.length} profiles`}
        />
      </div>

      {groupedStudents.length === 0 ? (
        <SectionCard title="No students found" subtitle="No matching profiles are available right now.">
          <p className="text-sm text-slate-400">Students register themselves through the public registration page and await admin approval.</p>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {groupedStudents.map(({ department, levels }) => (
            <SectionCard key={department} title={department} subtitle="Study levels and student list" actions={<span className="text-sm text-slate-400">{levels.length} groups</span>}>
              <div className="space-y-5">
                {levels.map(({ level, entries }) => (
                  <div key={`${department}-${level}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">{level}</h3>
                      <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-sm text-slate-400">
                        {entries.length} students
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {entries.map((student) => (
                        <motion.button
                          key={student.id}
                          whileHover={{ y: -2, scale: 1.01 }}
                          onClick={() => onSelectStudent(student)}
                          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <StudentAvatar photo={student.photo} firstName={student.firstName} lastName={student.lastName} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-white">{student.firstName} {student.lastName}</p>
                              <p className="text-sm text-slate-400">{student.apogee}</p>
                            </div>
                            <div>{isPresent(student) ? <StatusPill state="Present" successText="Present" /> : <StatusPill state="Absent" successText="Absent" />}</div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}



void getInitials;
function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-white">{value}</p>
    </div>
  );
}

export function AttendancePage({ searchTerm }: { searchTerm: string }) {
  const filtered = useMemo(() => attendanceRecords.filter((record) => `${record.name} ${record.apogee} ${record.room} ${record.teacher}`.toLowerCase().includes(searchTerm.toLowerCase())), [searchTerm]);

  const handleExportExcel = () => {
    const data = filtered.map(record => ({
      Student: record.name,
      Apogee: record.apogee,
      RFID: record.rfid,
      Room: record.room,
      Teacher: record.teacher,
      'Entry Time': record.entryTime,
      'Exit Time': record.exitTime,
      Duration: record.duration,
      Status: record.status,
      Attendance: record.attendance
    }));
    exportToExcel(data, `attendance_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportCSV = () => {
    const data = filtered.map(record => ({
      Student: record.name,
      Apogee: record.apogee,
      RFID: record.rfid,
      Room: record.room,
      Teacher: record.teacher,
      'Entry Time': record.entryTime,
      'Exit Time': record.exitTime,
      Duration: record.duration,
      Status: record.status,
      Attendance: record.attendance
    }));
    exportToCSV(data, `attendance_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance intelligence" subtitle="Search, filter, and export IoT-powered attendance sessions with a modern operations workflow." badge="Daily overview" />
          <SectionCard title="Attendance records" subtitle="Entry, exit, duration, and real-time occupancy" actions={<div className="flex gap-2"><button onClick={handleExportExcel} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">Export Excel</button><button onClick={handleExportCSV} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200">Export CSV</button></div>}>
        <div className="overflow-hidden rounded-3xl border border-slate-800">
          <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_0.6fr] bg-slate-950/80 px-4 py-3 text-sm text-slate-400 md:grid-cols-[1.6fr_0.8fr_0.8fr_0.7fr_0.7fr_0.7fr]">
            <span>Student</span>
            <span>Room</span>
            <span>Entry</span>
            <span>Exit</span>
            <span>Duration</span>
            <span>Status</span>
          </div>
          {filtered.map((record) => (
            <div key={record.id} className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_0.6fr] border-t border-slate-800 bg-slate-900/40 px-4 py-4 text-sm md:grid-cols-[1.6fr_0.8fr_0.8fr_0.7fr_0.7fr_0.7fr]">
              <div className="flex items-center gap-3">
                <StudentAvatar photo={record.photo} firstName={record.name.split(' ')[0]} lastName={record.name.split(' ').slice(1).join(' ')} size="sm" />
                <div>
                  <p className="font-medium text-white">{record.name}</p>
                  <p className="text-xs text-slate-400">{record.apogee}</p>
                </div>
              </div>
              <span className="text-slate-300">{record.room}</span>
              <span className="text-slate-300">{record.entryTime}</span>
              <span className="text-slate-300">{record.exitTime}</span>
              <span className="text-slate-300">{record.duration}</span>
              <StatusPill state={record.status} />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ClassroomPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Classroom control center" subtitle="Room-level monitoring for capacity, environmental conditions, and live teaching activity." badge="2 rooms monitored" />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {classrooms.map((room) => (
          <SectionCard key={room.id} title={room.name} subtitle={`${room.course} • ${room.teacher}`} actions={<StatusPill state="Online" successText="Connected" />}>
            <div className="space-y-4">
              <img src={room.image} alt={room.name} className="h-44 w-full rounded-3xl object-cover" />
              <div className="grid gap-3 md:grid-cols-2">
                <InfoCard label="Schedule" value={room.schedule} />
                <InfoCard label="Capacity" value={`${room.capacity} seats`} />
                <InfoCard label="Students inside" value={`${room.currentStudents}`} />
                <InfoCard label="Occupancy" value={`${room.occupancy}%`} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InfoCard label="Temperature" value={`${room.temperature}°C`} />
                <InfoCard label="Humidity" value={`${room.humidity}%`} />
                <InfoCard label="IR sensors" value={room.irEntry} />
                <InfoCard label="RFID status" value={room.rfidStatus} />
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">{room.activity}</div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function RfidPage() {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ rfidUID: '', studentId: '' });

  const handleAssignRfid = async () => {
    if (!assignForm.rfidUID.trim() || !assignForm.studentId.trim()) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast('Please fill in all fields.');
      return;
    }

    try {
      await setDoc(doc(db, 'rfid', assignForm.rfidUID), {
        uid: assignForm.rfidUID,
        studentId: assignForm.studentId,
        assignedDate: serverTimestamp(),
        status: 'Active'
      }, { merge: true });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast('RFID assigned successfully!');
      setAssignForm({ rfidUID: '', studentId: '' });
      setShowAssignModal(false);
    } catch (error) {
      console.error('Failed to assign RFID:', error);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast('Failed to assign RFID.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="RFID management" subtitle="Assign, replace, and review RFID usage across campus attendance points." badge="3 tagged devices" />
      <SectionCard title="RFID inventory" subtitle="Active, unknown, and replacement records" actions={<button onClick={() => setShowAssignModal(true)} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">Assign RFID</button>}>
        <div className="overflow-hidden rounded-3xl border border-slate-800">
          <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.7fr] bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
            <span>UID</span>
            <span>Student</span>
            <span>Status</span>
            <span>Last scan</span>
            <span>Scans</span>
          </div>
          {rfidRecords.map((record) => (
            <div key={record.id} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.7fr] border-t border-slate-800 bg-slate-900/40 px-4 py-4 text-sm">
              <span className="font-medium text-white">{record.uid}</span>
              <span className="text-slate-300">{record.student}</span>
              <StatusPill state={record.status} />
              <span className="text-slate-300">{record.lastScan}</span>
              <span className="text-slate-300">{record.scans}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300"><FileText size={22} /></div>
              <div>
                <p className="text-sm text-cyan-400">RFID Management</p>
                <h2 className="text-xl font-semibold text-white">Assign RFID Tag</h2>
              </div>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="RFID UID"
                value={assignForm.rfidUID}
                onChange={(e) => setAssignForm({ ...assignForm, rfidUID: e.target.value })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
              />
              <input
                type="text"
                placeholder="Student ID / Apogee"
                value={assignForm.studentId}
                onChange={(e) => setAssignForm({ ...assignForm, studentId: e.target.value })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleAssignRfid}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 font-semibold text-slate-950 transition hover:opacity-95"
                >
                  Assign
                </button>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-200 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Esp32Page() {
  const handleDeviceAction = async (deviceId: string, action: string) => {
    try {
      const actionData = {
        deviceId,
        action,
        timestamp: serverTimestamp(),
        status: 'pending'
      };

      await setDoc(doc(db, 'deviceActions', `${deviceId}_${Date.now()}`), actionData);

      let message = '';
      if (action === 'Restart') message = `Device ${deviceId} restart command sent.`;
      else if (action === 'OTA update') message = `OTA update initiated for ${deviceId}.`;
      else if (action === 'Reconnect') message = `Reconnect command sent to ${deviceId}.`;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast(message);
    } catch (error) {
      console.error('Device action failed:', error);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast('Device action failed.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="ESP32 monitoring" subtitle="Device health, network quality, and firmware telemetry from every campus edge node." badge="2 devices online" />
      <div className="grid gap-6 lg:grid-cols-2">
        {esp32Devices.map((device) => (
          <SectionCard key={device.id} title={device.name} subtitle={`IP ${device.ip} • ${device.mac}`} actions={<StatusPill state={device.status} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="WiFi signal" value={`${device.wifi}%`} />
              <InfoCard label="Firmware" value={device.firmware} />
              <InfoCard label="Temperature" value={`${device.temperature}°C`} />
              <InfoCard label="CPU usage" value={`${device.cpu}%`} />
              <InfoCard label="RAM usage" value={`${device.ram}%`} />
              <InfoCard label="Uptime" value={device.uptime} />
            </div>
            <div className="mt-4 flex gap-2">
                {['Restart', 'OTA update', 'Reconnect'].map((action) => <button key={action} onClick={() => handleDeviceAction(device.id, action)} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">{action}</button>)}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function SensorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Sensor monitoring" subtitle="IoT sensor health, readiness, and last update telemetry for the smart campus edge network." badge="7 sensors" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sensors.map((sensor) => (
          <SectionCard key={sensor.id} title={sensor.name} subtitle={sensor.type} actions={<StatusPill state={sensor.status} />}>
            <div className="space-y-3 text-sm text-slate-400">
              <p>{sensor.description}</p>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">Last update: {sensor.lastUpdate}</div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Notification center" subtitle="Campus alerting for RFID anomalies, occupancy saturation, device outages, and successful exports." badge="4 unread" />
      <div className="space-y-3">
        {notifications.map((item) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex gap-3">
              <div className={`rounded-2xl p-2 ${item.type === 'error' ? 'bg-rose-500/15 text-rose-300' : item.type === 'warning' ? 'bg-amber-500/15 text-amber-300' : item.type === 'success' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-cyan-500/15 text-cyan-300'}`}>
                {item.type === 'error' ? <AlertTriangle size={18} /> : item.type === 'warning' ? <AlertTriangle size={18} /> : item.type === 'success' ? <CheckCircle2 size={18} /> : <BellRing size={18} />}
              </div>
              <div>
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-slate-400">{item.description}</p>
              </div>
            </div>
            <span className="text-sm text-slate-500">{item.time}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AiInsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI insights" subtitle="Forecasts, ranking, recommendations, and occupancy intelligence for campus planning." badge="Predictive analytics" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Peak hours', value: aiInsights.peakHours }, { label: 'Most occupied room', value: aiInsights.mostOccupiedRoom }, { label: 'Predicted occupancy', value: aiInsights.predictedOccupancy }, { label: 'Average attendance', value: aiInsights.averageAttendance }].map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Attendance ranking" subtitle="Most engaged rooms and students">
          <div className="space-y-3">
            {attendanceRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{record.name}</p>
                  <p className="text-sm text-slate-400">{record.room}</p>
                </div>
                <span className="text-sm text-cyan-300">{record.attendance}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Recommendations" subtitle="Actionable campus operations proposals">
          <ul className="space-y-3 text-sm text-slate-400">
            {aiInsights.recommendations.map((recommendation) => (
              <li key={recommendation} className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3"><Sparkles size={16} className="text-cyan-400" />{recommendation}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function ReportsPage() {
  const handleExportReport = (reportType: string, format: 'excel' | 'pdf') => {
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${reportType.toLowerCase()}_report_${date}`;

    if (format === 'excel') {
      const reportData = attendanceRecords.map(record => ({
        'Report Type': reportType,
        'Date': date,
        Student: record.name,
        Apogee: record.apogee,
        Room: record.room,
        'Entry Time': record.entryTime,
        'Exit Time': record.exitTime,
        Status: record.status,
        Attendance: record.attendance
      }));
      exportToExcel(reportData, fileName);
    } else if (format === 'pdf') {
      const content = [
        `${reportType} Report`,
        `Generated: ${new Date().toLocaleString()}`,
        '---',
        `Total Records: ${attendanceRecords.length}`,
        'Attendance Summary:',
        ...attendanceRecords.slice(0, 10).map(r => `${r.name} - ${r.room} - ${r.status}`)
      ];
      exportToPDF(`${reportType} Report`, content, fileName);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports workspace" subtitle="Generate and export polished daily, weekly, monthly, semester, and custom reports." badge="Ready to publish" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {['Daily', 'Weekly', 'Monthly', 'Semester'].map((label) => (
          <SectionCard key={label} title={label} subtitle="Export-ready report" actions={<Download size={18} className="text-cyan-400" />}>
            <div className="flex gap-2">
              <button onClick={() => handleExportReport(label, 'excel')} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200">Excel</button>
              <button onClick={() => handleExportReport(label, 'pdf')} className="rounded-2xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200">PDF</button>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function StatisticsPage() {
  const attendanceChart = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [{ label: 'Attendance %', data: [86, 89, 84, 91, 93], borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.25)', fill: true, tension: 0.35 }],
  };
  const rankingChart = {
    labels: ['Students', 'Teachers', 'Rooms'],
    datasets: [{ label: 'Engagement', data: [84, 76, 91], backgroundColor: ['#22d3ee', '#818cf8', '#f472b6'] }],
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Statistics dashboard" subtitle="Beautiful charts, occupancy trends, and engagement analytics for decision-making." badge="Chart.js powered" />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Weekly attendance trend" subtitle="Multi-day attendance performance">
          <Line data={attendanceChart} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </SectionCard>
        <SectionCard title="Occupancy distribution" subtitle="Room usage by classroom">
          <Doughnut data={{ labels: ['Amphi A', 'Room B', 'Lab 1', 'Lab 2'], datasets: [{ data: [60, 55, 72, 48], backgroundColor: ['#06b6d4', '#8b5cf6', '#f59e0b', '#f43f5e'] }] }} options={{ responsive: true }} />
        </SectionCard>
      </div>
      <SectionCard title="Engagement comparison" subtitle="Comparative analysis for campus stakeholders">
        <Bar data={rankingChart} options={{ responsive: true, plugins: { legend: { display: false } } }} />
      </SectionCard>
    </div>
  );
}

function SecurityPage() {
  const roles = [
    { name: 'Administrator', perms: ['Full access', 'System configuration', 'Reports export'] },
    { name: 'Professor', perms: ['Attendance review', 'Classroom monitoring'] },
    { name: 'Technician', perms: ['Device diagnostics', 'Sensor maintenance'] },
    { name: 'Assistant', perms: ['Student support', 'Notifications'] },
    { name: 'Student', perms: ['Profile view', 'QR access'] },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Security and roles" subtitle="Permission-based roles for the smart campus platform." badge="RBAC ready" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <SectionCard key={role.name} title={role.name} subtitle="Current permissions" actions={<Shield size={18} className="text-cyan-400" />}>
            <ul className="space-y-2 text-sm text-slate-400">
              {role.perms.map((permission) => <li key={permission} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">{permission}</li>)}
            </ul>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Platform settings" subtitle="Configure appearance, room policy, and IoT integration preferences." badge="Enterprise-ready" />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Display and campus profile" subtitle="Theme, language, and branding settings">
          <div className="space-y-3">
            {['Dark mode', 'English', 'University logo', 'Academic year'].map((item) => <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"><span>{item}</span><ChevronRight size={16} className="text-slate-500" /></div>)}
          </div>
        </SectionCard>
        <SectionCard title="IoT and notification settings" subtitle="Firebase, ESP32, and alert policy configuration">
          <div className="space-y-3">
            {['Firebase configuration', 'ESP32 configuration', 'Room capacity', 'Notification settings'].map((item) => <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"><span>{item}</span><ChevronRight size={16} className="text-slate-500" /></div>)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function App() {
  const [searchTerm] = useState('');
  const [studentsList, setStudentsList] = useState<StudentProfile[]>(students);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(students[0]);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show sidebar on authentication pages
  const hideSidebar = ['/login', '/register', '/forgot-password', '/pending-approval'].includes(location.pathname);

  useEffect(() => {
    const studentsQuery = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(studentsQuery, (snapshot) => {
      const liveStudents = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<StudentProfile, 'id'>),
      }));
      setStudentsList(liveStudents);
      if (!selectedStudent && liveStudents.length > 0) {
        setSelectedStudent(liveStudents[0]);
      }
    }, (err) => console.error('Firestore onSnapshot error', err));
    return () => unsubscribe();
  }, [selectedStudent]);

  const handleSelectStudent = (student: StudentProfile) => {
    setSelectedStudent(student);
    navigate(`/students/${student.id}`);
  };

  function StudentProfileRoute() {
    const params = useParams();
    const id = params.studentId ?? '';
    const student = studentsList.find((s) => s.id === id || s.apogee === id);
    return student ? <StudentProfilePage student={student} /> : <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/80 text-slate-400">Student not found.</div>;
  }

  function EditStudentPage() {
    const params = useParams();
    const id = params.studentId ?? '';
    const [loading, setLoading] = useState(true);
    const [values, setValues] = useState({ firstName: '', lastName: '', email: '', department: '', room: '', rfidUID: '' });
    const navigate = useNavigate();

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const d = await getDoc(doc(db, 'students', id));
          if (d.exists() && mounted) {
            const data = d.data() as any;
            setValues({
              firstName: data.firstName ?? '',
              lastName: data.lastName ?? '',
              email: data.email ?? '',
              department: data.department ?? '',
              room: data.room ?? '',
              rfidUID: data.rfidUID ?? data.rfid ?? '',
            });
          }
        } catch (err) {
          console.error('Failed to load student', err);
        } finally {
          if (mounted) setLoading(false);
        }
      })();
      return () => { mounted = false; };
    }, [id]);

    async function handleSave(e: FormEvent) {
      e.preventDefault();
      try {
        await setDoc(doc(db, 'students', id), { ...values, updatedAt: serverTimestamp(), rfidUID: values.rfidUID }, { merge: true });
        navigate(`/students/${id}`);
      } catch (err) {
        console.error('Save failed', err);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof window.showAppToast === 'function') window.showAppToast('Save failed');
        else window.alert('Save failed');
      }
    }

    return (
      <div className="space-y-6">
        <PageHeader title={`Edit student ${id}`} subtitle="Update basic profile fields" badge={id} />
        <SectionCard title="Edit profile">
          {loading ? <p className="text-slate-400">Loading…</p> : (
            <form onSubmit={handleSave} className="grid gap-3 md:grid-cols-2">
              <input value={values.firstName} onChange={(e) => setValues({ ...values, firstName: e.target.value })} placeholder="First name" className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm" />
              <input value={values.lastName} onChange={(e) => setValues({ ...values, lastName: e.target.value })} placeholder="Last name" className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm" />
              <input value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} placeholder="Email" className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm" />
              <input value={values.department} onChange={(e) => setValues({ ...values, department: e.target.value })} placeholder="Department" className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm" />
              <input value={values.room} onChange={(e) => setValues({ ...values, room: e.target.value })} placeholder="Room" className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm" />
              <input value={values.rfidUID} onChange={(e) => setValues({ ...values, rfidUID: e.target.value })} placeholder="RFID UID" className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm" />
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="rounded-2xl bg-cyan-500 px-4 py-2 text-white">Save</button>
                <button type="button" onClick={() => navigate(-1)} className="rounded-2xl border border-slate-700 px-4 py-2 text-slate-200">Cancel</button>
              </div>
            </form>
          )}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      {!hideSidebar && <Sidebar />}
      <main className="flex-1 p-6 overflow-auto">
        <ToastRoot />
        <Routes>
          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/registration-pending" element={<PendingApprovalPage />} />
          <Route path="/pending-approval" element={<Navigate to="/registration-pending" replace />} />
          
          {/* Student Routes */}
          <Route path="/student/dashboard" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/student/profile" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentProfileView />
            </ProtectedRoute>
          } />
          <Route path="/student/attendance" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentAttendance />
            </ProtectedRoute>
          } />
          <Route path="/student/notifications" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentNotifications />
            </ProtectedRoute>
          } />
          <Route path="/student/settings" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentSettings />
            </ProtectedRoute>
          } />
          <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
          
          {/* Professor Routes */}
          <Route path="/professor/dashboard" element={
            <ProtectedRoute allowedRoles={['professor']}>
              <ProfessorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/professor/classes" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorClasses /></ProtectedRoute>} />
          <Route path="/professor/attendance" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorAttendance /></ProtectedRoute>} />
          <Route path="/professor/students" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorStudents /></ProtectedRoute>} />
          <Route path="/professor/students/:apogee" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorStudentProfilePage /></ProtectedRoute>} />
          <Route path="/professor/reports" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorReports /></ProtectedRoute>} />
          <Route path="/professor/statistics" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorStatistics /></ProtectedRoute>} />
          <Route path="/professor/notifications" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorNotifications /></ProtectedRoute>} />
          <Route path="/professor/profile" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorProfile /></ProtectedRoute>} />
          <Route path="/professor" element={<Navigate to="/professor/dashboard" replace />} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/pending-registrations" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PendingRegistrations />
            </ProtectedRoute>
          } />
          <Route path="/admin/rfid-management" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RFIDManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="Student Management" description="Manage enrolled students, records, and registration states." accent="rose" highlights={['Edit student records','Approvals','Academic tracking']} /></ProtectedRoute>} />
          <Route path="/admin/professors" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="Professor Management" description="Maintain professor profiles, departments, and classroom assignments." accent="rose" highlights={['Professor profiles','Department assignment','Course oversight']} /></ProtectedRoute>} />
          <Route path="/admin/classrooms" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="Classroom Management" description="Monitor occupancy, room assignments, and availability in real time." accent="rose" highlights={['Occupancy insights','Room policies','Instructor scheduling']} /></ProtectedRoute>} />
          <Route path="/admin/attendance" element={<ProtectedRoute allowedRoles={['admin']}><LiveAttendancePage portal="Admin" /></ProtectedRoute>} />
          <Route path="/admin/classes" element={<ProtectedRoute allowedRoles={['admin']}><AdminClassesPage /></ProtectedRoute>} />
          <Route path="/admin/esp32" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="ESP32 Device Operations" description="Monitor connected devices and manage IoT health from the admin portal." accent="rose" highlights={['Device health','Signal checks','Offline alerts']} /></ProtectedRoute>} />
          <Route path="/admin/sensors" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="Sensor Monitoring" description="Inspect environmental sensors and alert conditions across campus buildings." accent="rose" highlights={['Environmental telemetry','Threshold alerts','Operations visibility']} /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="System Notifications" description="Coordinate updates for registration, RFID, room changes, and platform health." accent="rose" highlights={['Administrative alerts','Role-based notices','Campus-wide updates']} /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="Institution Reports" description="Export reports for departments, enrollment, and operational review." accent="rose" highlights={['Semester reports','Operational exports','Leadership dashboards']} /></ProtectedRoute>} />
          <Route path="/admin/statistics" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="Campus Statistics" description="Track performance indicators, participation, and room usage trends." accent="rose" highlights={['Campus KPIs','Trend analysis','Decision support']} /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><RoleAccessPage title="System Settings" description="Configure campus-wide rules, integrations, and operational preferences." accent="rose" highlights={['Platform settings','IoT configuration','Security controls']} /></ProtectedRoute>} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          
          {/* Legacy Routes - Keep existing functionality */}
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><DashboardPage onSelectStudent={handleSelectStudent} searchTerm={searchTerm} students={studentsList} /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin']}><LiveAttendancePage portal="Admin" /></ProtectedRoute>} />
          <Route path="/classrooms" element={<ProtectedRoute allowedRoles={['admin']}><ClassroomPage /></ProtectedRoute>} />
          <Route path="/rfid" element={<ProtectedRoute allowedRoles={['admin']}><RfidPage /></ProtectedRoute>} />
          <Route path="/esp32" element={<ProtectedRoute allowedRoles={['admin']}><Esp32Page /></ProtectedRoute>} />
          <Route path="/sensors" element={<ProtectedRoute allowedRoles={['admin']}><SensorsPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute allowedRoles={['admin']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/ai" element={<ProtectedRoute allowedRoles={['admin']}><AiInsightsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/statistics" element={<ProtectedRoute allowedRoles={['admin']}><StatisticsPage /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute allowedRoles={['admin']}><SecurityPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
          <Route path="/students/:studentId/edit" element={<ProtectedRoute allowedRoles={['admin']}><EditStudentPage /></ProtectedRoute>} />
          <Route path="/students/:studentId" element={<ProtectedRoute allowedRoles={['admin']}><StudentProfileRoute /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute allowedRoles={['admin']}><StudentsPage students={studentsList} onSelectStudent={handleSelectStudent} searchTerm={searchTerm} /></ProtectedRoute>} />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
