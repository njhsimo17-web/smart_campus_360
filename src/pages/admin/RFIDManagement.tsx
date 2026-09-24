import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Search, CheckCircle2, Clock, User, AlertCircle, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Student, RFIDCard } from '../../types';

export default function RFIDManagement() {
  const [studentsWithoutRFID, setStudentsWithoutRFID] = useState<Student[]>([]);
  const [rfidCards, setRfidCards] = useState<RFIDCard[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedUID, setScannedUID] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignMode, setAssignMode] = useState(false);

  useEffect(() => {
    // Fetch students without RFID
    const studentsQuery = query(collection(db, 'students'), where('rfidUID', '==', null));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const students = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Student[];
      setStudentsWithoutRFID(students);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching students:', err);
      setLoading(false);
    });

    // Fetch RFID cards
    const rfidQuery = query(collection(db, 'rfidCards'));
    const unsubscribeRFID = onSnapshot(rfidQuery, (snapshot) => {
      const cards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RFIDCard[];
      setRfidCards(cards);
    }, (err) => {
      console.error('Error fetching RFID cards:', err);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeRFID();
    };
  }, []);

  const filteredStudents = studentsWithoutRFID.filter((student) =>
    `${student.firstName} ${student.lastName} ${student.apogee}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartScan = () => {
    setScanning(true);
    setScannedUID('');
    setAssignMode(true);

    // Simulate ESP32 scan - in real implementation, this would listen to Firebase real-time updates
    // or WebSocket connection to ESP32
    setTimeout(() => {
      // Mock scan - replace with actual ESP32 integration
      const mockUID = `04A3B${Math.random().toString(16).substr(2, 4).toUpperCase()}`;
      setScannedUID(mockUID);
      setScanning(false);
    }, 3000);
  };

  const handleAssignRFID = async () => {
    if (!selectedStudent || !scannedUID) return;

    try {
      // Update student with RFID UID
      const studentRef = doc(db, 'students', selectedStudent.apogee);
      await updateDoc(studentRef, {
        rfidUID: scannedUID,
        updatedAt: serverTimestamp(),
      });

      // Create/update RFID card record
      const rfidRef = doc(db, 'rfidCards', scannedUID);
      await setDoc(rfidRef, {
        rfidUID: scannedUID,
        studentId: selectedStudent.apogee,
        studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        assignedDate: serverTimestamp(),
        status: 'Active',
        scans: 0,
      }, { merge: true });

      // Create notification for student
      await updateDoc(doc(db, 'notifications', `rfid_${selectedStudent.apogee}_${Date.now()}`), {
        type: 'success',
        title: 'RFID Card Assigned',
        description: `Your RFID card (${scannedUID}) has been successfully assigned.`,
        userId: selectedStudent.id,
        role: 'student',
        read: false,
        createdAt: serverTimestamp(),
      });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast('RFID assigned successfully!');

      // Reset state
      setSelectedStudent(null);
      setScannedUID('');
      setAssignMode(false);
    } catch (error) {
      console.error('Error assigning RFID:', error);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast('Failed to assign RFID.');
    }
  };

  const getInitials = (student: Student) => {
    const first = student.firstName?.[0] || '';
    const last = student.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">RFID Management</h1>
          <p className="mt-1 text-sm text-slate-400">Assign RFID cards to approved students</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-300">
            {rfidCards.filter((c) => c.status === 'Active').length} Active Cards
          </div>
        </div>
      </div>

      {/* RFID Scanner Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <h2 className="mb-4 text-xl font-semibold text-white">RFID Scanner</h2>
        
        {assignMode ? (
          <div className="space-y-4">
            {selectedStudent && (
              <div className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                {selectedStudent.photo ? (
                  <img src={selectedStudent.photo} alt={selectedStudent.firstName} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-sm font-semibold text-cyan-400">
                    {getInitials(selectedStudent)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  <p className="text-sm text-slate-400">{selectedStudent.apogee}</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center">
              {scanning ? (
                <div className="space-y-4">
                  <Loader2 size={48} className="mx-auto animate-spin text-cyan-400" />
                  <p className="text-lg font-medium text-white">Waiting for RFID scan...</p>
                  <p className="text-sm text-slate-400">Please scan the RFID card with ESP32</p>
                </div>
              ) : scannedUID ? (
                <div className="space-y-4">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
                  <div>
                    <p className="text-lg font-medium text-white">RFID Detected!</p>
                    <p className="text-2xl font-mono font-semibold text-cyan-400">{scannedUID}</p>
                  </div>
                  <button
                    onClick={handleAssignRFID}
                    className="rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600 transition"
                  >
                    Assign RFID to Student
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <AlertCircle size={48} className="mx-auto text-amber-400" />
                  <p className="text-lg font-medium text-white">Ready to Scan</p>
                  <button
                    onClick={handleStartScan}
                    className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-white hover:bg-cyan-600 transition"
                  >
                    Start RFID Scan
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setAssignMode(false);
                setSelectedStudent(null);
                setScannedUID('');
              }}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAssignMode(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 px-6 py-3 font-semibold text-white hover:opacity-95 transition"
          >
            <Radio size={20} />
            Start RFID Assignment
          </button>
        )}
      </motion.div>

      {/* Students Without RFID */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Students Without RFID</h2>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 rounded-2xl border border-slate-700 bg-slate-950/70 pl-10 pr-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-8">
            <User size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">No students found</p>
            <p className="mt-2 text-sm text-slate-500">All approved students have RFID cards assigned</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {student.photo ? (
                    <img src={student.photo} alt={student.firstName} className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-sm font-semibold text-cyan-400">
                      {getInitials(student)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-sm text-slate-400">{student.apogee} • {student.department}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(student);
                    setAssignMode(true);
                  }}
                  disabled={assignMode}
                  className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition disabled:opacity-50"
                >
                  Assign RFID
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Active RFID Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <h2 className="mb-4 text-xl font-semibold text-white">Active RFID Cards</h2>
        <div className="space-y-3">
          {rfidCards.filter((c) => c.status === 'Active').slice(0, 5).map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/15 p-2 text-cyan-400">
                  <Radio size={18} />
                </div>
                <div>
                  <p className="font-mono font-medium text-white">{card.uid}</p>
                  <p className="text-sm text-slate-400">{card.studentName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{card.scans} scans</span>
                </div>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
