import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, BarChart3, BookOpen, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Professor } from '../../types';

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../../firebase';

interface StudentRecord {
  id: string;
  uid?: string;
  apogee?: string;
  status?: string;
  approved?: boolean;
}

interface AttendanceRecord {
  id: string;
  studentUid: string;
  studentApogee: string;
  studentName: string;
  department: string;
  program: string;
  level: string;
  room: string;
  event: string;
  rfidUID: string;
  createdAt?: Timestamp;
}

export default function ProfessorDashboard() {
  const { userData } = useAuth();
  const professor = userData as Professor;
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    const unsubscribeStudents = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        setStudents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as StudentRecord[]);
        setStudentsLoading(false);
      },
      (error) => {
        console.error('Professor dashboard students listener error:', error);
        setDashboardError('Unable to load dashboard data.');
        setStudentsLoading(false);
      },
    );

    const attendanceQuery = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'), limit(1000));
    const unsubscribeAttendance = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        setAttendance(snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            studentUid: String(data.studentUid || ''),
            studentApogee: String(data.studentApogee || ''),
            studentName: String(data.studentName || ''),
            department: String(data.department || ''),
            program: String(data.program || ''),
            level: String(data.level || ''),
            room: String(data.room || ''),
            event: String(data.event || '').toUpperCase(),
            rfidUID: String(data.rfidUID || ''),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
          };
        }));
        setAttendanceLoading(false);
      },
      (error) => {
        console.error('Professor dashboard attendance listener error:', error);
        setDashboardError('Unable to load dashboard data.');
        setAttendanceLoading(false);
      },
    );

    return () => {
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, []);

  const activeStudents = useMemo(
    () => students.filter((student) => student.status?.toLowerCase() === 'active' || student.approved === true),
    [students],
  );

  const latestEventByStudent = useMemo(() => {
    const latest = new Map<string, AttendanceRecord>();
    attendance.forEach((record) => {
      const keys = [record.studentUid, record.studentApogee].filter(Boolean);
      if (keys.some((key) => latest.has(key))) return;
      keys.forEach((key) => latest.set(key, record));
    });
    return latest;
  }, [attendance]);

  const presentStudentRecords = useMemo(
    () => activeStudents.map((student) => latestEventByStudent.get(student.uid || '') || latestEventByStudent.get(student.apogee || '')).filter((record): record is AttendanceRecord => record?.event === 'ENTRY'),
    [activeStudents, latestEventByStudent],
  );

  const classroomStats = useMemo(() => {
    const totalStudents = activeStudents.length;
    const presentToday = presentStudentRecords.length;
    return {
      totalStudents,
      presentToday,
      absentToday: Math.max(totalStudents - presentToday, 0),
      averageAttendance: totalStudents ? Math.round((presentToday / totalStudents) * 100) : 0,
    };
  }, [activeStudents, presentStudentRecords]);

  const currentClassroom = useMemo(() => {
    const roomCounts = new Map<string, number>();
    presentStudentRecords.forEach((record) => {
      if (record.room) roomCounts.set(record.room, (roomCounts.get(record.room) || 0) + 1);
    });
    const current = [...roomCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!current) return null;
    return {
      name: current[0],
      course: `${current[1]} students currently present`,
      capacity: Math.max(classroomStats.totalStudents, current[1], 1),
      currentStudents: current[1],
    };
  }, [presentStudentRecords, classroomStats.totalStudents]);

  const recentActivity = useMemo(() => attendance.slice(0, 20).map((record) => ({
    id: record.id,
    type: record.event === 'ENTRY' ? 'entry' : record.event === 'EXIT' ? 'exit' : 'alert',
    student: record.studentName || 'Unknown RFID',
    room: record.room || '-',
    time: record.createdAt?.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '--:--',
  })), [attendance]);

  const loading = studentsLoading || attendanceLoading;
  const getInitials = () => {
    if (!professor) return '??';
    const first = professor.firstName?.[0] || '';
    const last = professor.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  if (loading) {
    return <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-12 text-center text-slate-400">Loading dashboard...</div>;
  }

  if (dashboardError) {
    return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">{dashboardError}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <div className="flex items-center gap-4">
          {professor?.photo ? (
            <img src={professor.photo} alt={professor.firstName} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20 text-2xl font-semibold text-purple-400">
              {getInitials()}
            </div>
          )}
          <div>
            <p className="text-sm text-purple-400">Professor Portal</p>
            <h1 className="text-2xl font-semibold text-white">
              {professor?.firstName} {professor?.lastName}
            </h1>
            <p className="text-sm text-slate-400">{professor?.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300">
            Online
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
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Students</p>
              <p className="text-2xl font-semibold text-white">{classroomStats.totalStudents}</p>
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
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Present Today</p>
              <p className="text-2xl font-semibold text-white">{classroomStats.presentToday}</p>
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
            <div className="rounded-2xl bg-rose-500/15 p-3 text-rose-400">
              <XCircle size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Absent Today</p>
              <p className="text-2xl font-semibold text-white">{classroomStats.absentToday}</p>
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
            <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Avg Attendance</p>
              <p className="text-2xl font-semibold text-white">{classroomStats.averageAttendance}%</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Classroom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <h2 className="mb-4 text-xl font-semibold text-white">Current Classroom</h2>
          {currentClassroom ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-400">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-white">{currentClassroom.name}</p>
                    <p className="text-sm text-slate-400">{currentClassroom.course}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Occupancy</p>
                  <p className="text-lg font-semibold text-white">
                    {currentClassroom.currentStudents}/{currentClassroom.capacity}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-400">Room Capacity</p>
                  <p className="text-sm font-medium text-white">{Math.round((currentClassroom.currentStudents / currentClassroom.capacity) * 100)}%</p>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                    style={{ width: `${(currentClassroom.currentStudents / currentClassroom.capacity) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No active classroom</p>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <h2 className="mb-4 text-xl font-semibold text-white">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${activity.type === 'entry' ? 'bg-emerald-500/15 text-emerald-400' : activity.type === 'exit' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {activity.type === 'entry' ? <CheckCircle2 size={16} /> : activity.type === 'exit' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div>
                    <p className="font-medium text-white">{activity.student}</p>
                    <p className="text-sm text-slate-400">{activity.room}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock size={14} />
                  <span>{activity.time}</span>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No RFID scans found.</p>}
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
              <Calendar size={20} />
            </div>
            <div>
              <p className="font-medium text-white">Take Attendance</p>
              <p className="text-sm text-slate-400">Mark student presence</p>
            </div>
          </button>

          <button className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-left hover:bg-slate-800 transition">
            <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-400">
              <Users size={20} />
            </div>
            <div>
              <p className="font-medium text-white">View Students</p>
              <p className="text-sm text-slate-400">See enrolled students</p>
            </div>
          </button>

          <button className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-left hover:bg-slate-800 transition">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="font-medium text-white">View Reports</p>
              <p className="text-sm text-slate-400">Attendance statistics</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
