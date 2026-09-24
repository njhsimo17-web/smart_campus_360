import { motion } from 'framer-motion';
import { User, Calendar, Bell, Settings, QrCode, Download, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Student } from '../../types';
import StudentAvatar from '../../components/StudentAvatar';
import { useStudentAttendance } from '../../hooks/useStudentAttendance';
import SmartCampusLogo from '../../components/SmartCampusLogo';

export default function StudentDashboard() {
  const { currentUser, userData } = useAuth();
  const student = userData as Student;
  const liveAttendance = useStudentAttendance(currentUser?.uid);
  const attendance = liveAttendance.records.length ? Math.round(liveAttendance.records.filter(record => record.event === 'ENTRY').length / liveAttendance.records.length * 100) : Number(student?.attendance || 0);
  const todayStatus: 'Present' | 'Absent' = liveAttendance.latest?.event === 'ENTRY' ? 'Present' : 'Absent';
  const currentRoom = todayStatus === 'Present' ? liveAttendance.latest?.room || '—' : '—';
  const recentAttendance = liveAttendance.records.slice(0, 4).map(record => ({ date: record.createdAt?.toDate?.().toLocaleString() || '—', status: record.event === 'ENTRY' ? 'Present' : 'Absent', room: record.room || '—' }));

  const rfidAssigned = !!student?.rfidUID;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <div className="flex items-center gap-4">
          <SmartCampusLogo size="md" className="hidden sm:inline-flex" />
          <StudentAvatar photo={student?.photo} firstName={student?.firstName} lastName={student?.lastName} size="lg" />
          <div>
            <p className="text-sm text-cyan-400">Welcome back,</p>
            <h1 className="text-2xl font-semibold text-white">
              {student?.firstName} {student?.lastName}
            </h1>
            <p className="text-sm text-slate-400">{student?.department} â€¢ {student?.level}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-full px-4 py-2 text-sm font-medium ${rfidAssigned ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {rfidAssigned ? 'RFID Assigned' : 'RFID Not Assigned'}
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-400">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Attendance</p>
              <p className="text-2xl font-semibold text-white">{attendance}%</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${todayStatus === 'Present' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
              {todayStatus === 'Present' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            </div>
            <div>
              <p className="text-sm text-slate-400">Today's Status</p>
              <p className="text-2xl font-semibold text-white">{todayStatus}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-400">
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Current Room</p>
              <p className="text-2xl font-semibold text-white">{currentRoom}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-400">
              <Bell size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Notifications</p>
              <p className="text-2xl font-semibold text-white">3</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Attendance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <h2 className="mb-4 text-xl font-semibold text-white">Recent Attendance</h2>
          <div className="space-y-3">
            {recentAttendance.map((record, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${record.status === 'Present' ? 'bg-emerald-500/15 text-emerald-400' : record.status === 'Late' ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {record.status === 'Present' ? <CheckCircle2 size={16} /> : record.status === 'Late' ? <Clock size={16} /> : <XCircle size={16} />}
                  </div>
                  <div>
                    <p className="font-medium text-white">{record.date}</p>
                    <p className="text-sm text-slate-400">{record.room}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${record.status === 'Present' ? 'text-emerald-400' : record.status === 'Late' ? 'text-amber-400' : 'text-rose-400'}`}>
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Student Card / QR Code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <h2 className="mb-4 text-xl font-semibold text-white">Student Card</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-400">
                  <QrCode size={24} />
                </div>
                <div>
                  <p className="font-medium text-white">QR Access Code</p>
                  <p className="text-sm text-slate-400">ID: {student?.apogee || 'â€”'}</p>
                </div>
              </div>
              <button className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition">
                View QR
              </button>
            </div>

            <button className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-200 hover:bg-slate-800 transition">
              <Download size={18} />
              Download Student Card
            </button>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Profile Completion</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: '85%' }} />
                </div>
                <span className="text-sm font-medium text-white">85%</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <h2 className="mb-4 text-xl font-semibold text-white">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <button className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-left hover:bg-slate-800 transition">
            <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-400">
              <User size={20} />
            </div>
            <div>
              <p className="font-medium text-white">Edit Profile</p>
              <p className="text-sm text-slate-400">Update your information</p>
            </div>
          </button>

          <button className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-left hover:bg-slate-800 transition">
            <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-400">
              <Calendar size={20} />
            </div>
            <div>
              <p className="font-medium text-white">View Attendance</p>
              <p className="text-sm text-slate-400">Check your history</p>
            </div>
          </button>

          <button className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-left hover:bg-slate-800 transition">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-400">
              <Settings size={20} />
            </div>
            <div>
              <p className="font-medium text-white">Settings</p>
              <p className="text-sm text-slate-400">Manage preferences</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

