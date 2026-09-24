import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, X, Eye, CheckCircle2, XCircle, Calendar, Mail, Phone, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, writeBatch, addDoc, doc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import type { Student } from '../../types';
import StudentAvatar from '../../components/StudentAvatar';

interface PendingStudent extends Student {
  id: string;
  uid: string;
}

const showToast = (message: string) => {
  if (typeof window !== 'undefined' && typeof (window as Window & { showAppToast?: (message: string) => void }).showAppToast === 'function') {
    (window as Window & { showAppToast?: (message: string) => void }).showAppToast?.(message);
  }
};

const approveStudent = async (student: PendingStudent) => {
  console.log('Approving student:', student);
  const uid = student.uid;
  const apogee = student.apogee;
  if (!uid || !apogee) throw new Error('Missing student UID or Apogee.');
  console.log('Current admin UID:', auth.currentUser?.uid);

  const batch = writeBatch(db);
  const studentRef = doc(db, 'students', apogee);
  const userRef = doc(db, 'users', uid);
  const notificationRef = doc(collection(db, 'notifications'));
  const logRef = doc(collection(db, 'logs'));
  const year = new Date().getFullYear();
  const studentId = student.studentId || `STU-${year}-${apogee}`;
  const universityRegistrationNumber = student.universityRegistrationNumber || `UIT-${year}-${apogee}`;

  batch.update(studentRef, {
    status: 'active',
    approved: true,
    approvedAt: serverTimestamp(),
    studentId,
    universityRegistrationNumber,
    updatedAt: serverTimestamp(),
  });
  batch.update(userRef, {
    status: 'active',
    approved: true,
    approvedAt: serverTimestamp(),
    studentId,
    updatedAt: serverTimestamp(),
  });
  batch.set(notificationRef, {
    type: 'registration_approved',
    title: 'Registration approved',
    message: 'Your registration has been approved.',
    recipientUid: uid,
    studentUid: uid,
    studentApogee: apogee,
    read: false,
    createdAt: serverTimestamp(),
  });
  batch.set(logRef, {
    type: 'student_registration_approved',
    adminUid: auth.currentUser?.uid,
    studentUid: uid,
    studentApogee: apogee,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
};

const rejectStudent = async (student: PendingStudent) => {
  if (!student.uid || !student.apogee) {
    throw new Error('Missing student uid or apogee number.');
  }

  // Deleting the Firebase Authentication user from the frontend is intentionally avoided.
  // This requires Firebase Admin SDK or a Cloud Function.
  await deleteDoc(doc(db, 'students', student.apogee));
  await deleteDoc(doc(db, 'users', student.uid));
  await addDoc(collection(db, 'logs'), {
    type: 'registration_rejected',
    studentUid: student.uid,
    studentApogee: student.apogee,
    createdAt: serverTimestamp(),
  });
};

export default function PendingRegistrations() {
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<PendingStudent | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);
  const [migratingLegacy,setMigratingLegacy]=useState(false);

  const migrateLegacyStudents=async()=>{
    const legacy=[['12345678','Mouad Sbai'],['64356834','Mohamed Najeh'],['653872275','Mahmoud Jouadi'],['837562','Abderrahman Benmousa'],['8834627','Taha Lamrioui'],['H845785','Mosaab Mantourane']] as const;
    setMigratingLegacy(true);
    try{
      const verified=await Promise.all(legacy.map(async([apogee,name])=>{const ref=doc(db,'students',apogee);const snapshot=await getDoc(ref);if(!snapshot.exists()){console.warn('Legacy student document not found:',{apogee,name});return null;}const data=snapshot.data();const actualName=`${data.firstName||''} ${data.lastName||''}`.trim().toLowerCase();if(actualName!==name.toLowerCase()){console.warn('Legacy student name mismatch; skipped:',{apogee,expected:name,actual:actualName});return null;}console.log('Legacy student verified:',{apogee,name,student:data});return ref;}));
      const existing=verified.filter((ref):ref is NonNullable<typeof ref>=>ref!==null);
      if(existing.length){const batch=writeBatch(db);existing.forEach(ref=>batch.update(ref,{department:'Physique',program:'Électronique Embarquée',level:'Master 1',updatedAt:serverTimestamp()}));await batch.commit();}
      showToast('Legacy students migrated successfully.');
    }catch(error){const failure=error as {code?:string;message?:string};console.error('Legacy student migration error:',failure.code,failure.message);showToast(failure.message||'Legacy student migration failed.');}finally{setMigratingLegacy(false);}
  };

  useEffect(() => {
    const q = query(collection(db, 'students'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PendingStudent[];
      setPendingStudents(students);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching pending students:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (student: PendingStudent) => {
    setProcessingStudentId(student.id);
    try {
      await approveStudent(student);
      setPendingStudents((current) => current.filter((item) => item.id !== student.id));
      showToast('Student approved successfully.');
    } catch (error) {
      const failure = error as { code?: string; message?: string };
      console.error('Approve student error:', { code: failure?.code, message: failure?.message, student });
      showToast(failure?.message || 'Failed to approve student.');
    } finally {
      setProcessingStudentId(null);
    }
  };

  const handleReject = async (student: PendingStudent) => {
    setProcessingStudentId(student.id);
    try {
      await rejectStudent(student);
      setPendingStudents((current) => current.filter((item) => item.id !== student.id));
      showToast('Student registration rejected.');
    } catch (error) {
      console.error('Error rejecting student:', error);
      showToast('Failed to reject student.');
    } finally {
      setProcessingStudentId(null);
      setShowRejectConfirm(false);
      setSelectedStudent(null);
      setShowDetails(false);
    }
  };

  const formatTimestamp = (value: any) => {
    if (!value) return '—';
    if (typeof value.toDate === 'function') {
      return value.toDate().toLocaleString();
    }
    return new Date(value).toLocaleString();
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
          <h1 className="text-3xl font-semibold text-white">Pending Registrations</h1>
          <p className="mt-1 text-sm text-slate-400">Review and approve student registration requests</p>
        </div>
        <div className="flex items-center gap-3"><button type="button" onClick={()=>void migrateLegacyStudents()} disabled={migratingLegacy} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 disabled:opacity-50">{migratingLegacy&&<Loader2 size={16} className="animate-spin"/>}Migrate Legacy Students</button><div className="rounded-full bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-300">{pendingStudents.length} Pending</div></div>
      </div>

      {pendingStudents.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-12 text-center">
          <UserCheck size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-lg font-medium text-slate-400">No pending registrations</p>
          <p className="mt-2 text-sm text-slate-500">All student registrations have been processed</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingStudents.map((student) => {
            const isWorking = processingStudentId === student.id;
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
              >
                <div className="mb-4 flex items-start gap-4">
                  <StudentAvatar photo={student.photo} firstName={student.firstName} lastName={student.lastName} size="lg" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">
                      {student.firstName} {student.lastName}
                    </h3>
                    <p className="text-sm text-slate-400">{student.apogee}</p>
                    <p className="text-sm text-slate-400">{student.department}</p>
                  </div>
                </div>

                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail size={14} />
                    <span>{student.email}</span>
                  </div>
                  {student.phone && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Phone size={14} />
                      <span>{student.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={14} />
                    <span>{student.level} • {student.academicYear}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-medium">Registered:</span>
                    <span>{formatTimestamp(student.createdAt)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => void handleApprove(student)}
                    disabled={isWorking}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isWorking ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStudent(student);
                      setShowRejectConfirm(true);
                    }}
                    disabled={isWorking}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStudent(student);
                      setShowDetails(true);
                    }}
                    className="flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-300 hover:bg-slate-800 transition"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {showDetails && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Student Details</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="rounded-2xl border border-slate-700 bg-slate-950/80 p-2 text-slate-300 hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <StudentAvatar photo={selectedStudent.photo} firstName={selectedStudent.firstName} lastName={selectedStudent.lastName} size="xl" className="!h-24 !w-24 !text-3xl" />
                <div>
                  <h3 className="text-2xl font-semibold text-white">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </h3>
                  <p className="text-slate-400">{selectedStudent.apogee}</p>
                  <p className="text-sm text-slate-400">{selectedStudent.department}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-400">Email</p>
                  <p className="font-medium text-white">{selectedStudent.email}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-400">Phone</p>
                  <p className="font-medium text-white">{selectedStudent.phone || '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-400">Level</p>
                  <p className="font-medium text-white">{selectedStudent.level}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-400">Academic Year</p>
                  <p className="font-medium text-white">{selectedStudent.academicYear}</p>
                </div>
                {selectedStudent.address && (
                  <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-sm text-slate-400">Address</p>
                    <p className="font-medium text-white">{selectedStudent.address}</p>
                  </div>
                )}
                {selectedStudent.emergencyContact && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-sm text-slate-400">Emergency Contact</p>
                    <p className="font-medium text-white">{selectedStudent.emergencyContact}</p>
                  </div>
                )}
                {selectedStudent.emergencyPhone && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-sm text-slate-400">Emergency Phone</p>
                    <p className="font-medium text-white">{selectedStudent.emergencyPhone}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDetails(false);
                    void handleApprove(selectedStudent);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-600 transition"
                >
                  <CheckCircle2 size={18} />
                  Approve
                </button>
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedStudent(selectedStudent);
                    setShowRejectConfirm(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 font-semibold text-white hover:bg-rose-600 transition"
                >
                  <XCircle size={18} />
                  Reject
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showRejectConfirm && selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl"
          >
            <h2 className="text-xl font-semibold text-white">Reject registration?</h2>
            <p className="mt-2 text-sm text-slate-400">
              This will delete the pending student record and user record. The authentication account will remain pending for admin cleanup through Firebase Admin SDK or Cloud Functions.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => void handleReject(selectedStudent)}
                className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 font-semibold text-white hover:bg-rose-600 transition"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => {
                  setShowRejectConfirm(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 font-semibold text-slate-200 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
