import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, AlertTriangle, Camera, Save, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, doc, getDocs, query, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Student } from '../../types';
import StudentAvatar from '../../components/StudentAvatar';
import ProfileImageUpload from '../../components/ProfileImageUpload';
import { uploadProfileImage } from '../../services/cloudinary';

const departments=['Physique','Chimie','Informatique','Mathématiques'];
const programsByDepartment:Record<string,string[]>={Physique:['Électronique Embarquée','Énergies Renouvelables','Systèmes de Télécommunication'],Chimie:[],Informatique:[],Mathématiques:[]};
const levels=['Master 1','Master 2'];

export default function StudentProfile() {
  const { currentUser, userData, refreshUserData } = useAuth();
  const [studentData, setStudentData] = useState<Student | null>(null);
  const student = studentData ?? (userData as Student | null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photoFile,setPhotoFile]=useState<File|null>(null);
  const [photoError,setPhotoError]=useState('');
  const [formData, setFormData] = useState({
    phone: '',
    photo: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    department: '',
    program: '',
    level: '',
  });

  useEffect(() => {
    const loadStudentProfile = async () => {
      if (!currentUser?.uid) {
        setStudentData(null);
        return;
      }

      try {
        const studentsRef = collection(db, 'students');
        let studentQuery = query(studentsRef, where('uid', '==', currentUser.uid));
        let snapshot = await getDocs(studentQuery);

        if (snapshot.empty && currentUser.email) {
          const normalizedEmail = currentUser.email.trim().toLowerCase();
          studentQuery = query(studentsRef, where('email', '==', normalizedEmail));
          snapshot = await getDocs(studentQuery);
        }

        if (!snapshot.empty) {
          const studentDoc = snapshot.docs[0];
          const studentDocData = studentDoc.data() as Partial<Student>;
          const loadedStudent = {
            ...(studentDocData as Student),
            id: studentDoc.id,
            uid: (studentDocData as Student & { uid?: string }).uid || currentUser.uid,
            email: (studentDocData as Student & { email?: string }).email || currentUser.email || '',
            role: 'student' as const,
            status: (studentDocData.status || userData?.status || 'pending') as Student['status'],
          } as Student;

          setStudentData(loadedStudent);
          console.log('Student document:', loadedStudent);
          console.log('RFID:', loadedStudent.rfidUID);
        } else if (userData && (userData as Student).role === 'student') {
          setStudentData(userData as Student);
        } else {
          setStudentData(null);
        }
      } catch (error) {
        console.error('Error loading student profile:', error);
        setStudentData(null);
      }
    };

    void loadStudentProfile();
  }, [currentUser, userData]);

  useEffect(() => {
    if (student) {
      setFormData({
        phone: student.phone || '',
        photo: student.photo || '',
        address: student.address || '',
        emergencyContact: student.emergencyContact || '',
        emergencyPhone: student.emergencyPhone || '',
        department: student.department || '',
        program: student.program || '',
        level: student.level || '',
      });
    }
  }, [student]);

  const handleSave = async () => {
    if (!student) return;
    setLoading(true);
    setSuccess(false);

    try {
      if (!student?.apogee) {
        throw new Error('Student profile is missing an apogee number.');
      }

      const studentRef = doc(db, 'students', student.apogee);
      if(!formData.department||!formData.program||!formData.level||[formData.department,formData.program,formData.level].includes('Unspecified'))throw new Error('Department, program, and study level are required.');
      let photo=formData.photo;
      if(photoFile){ console.log('Cloudinary Upload Started'); photo=await uploadProfileImage(photoFile); console.log('Cloudinary Upload Finished'); }
      await updateDoc(studentRef, {
        ...formData, photo,
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
      setEditing(false);
      setPhotoFile(null);
      await refreshUserData();

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof window.showAppToast === 'function') window.showAppToast('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (student) {
      setFormData({
        phone: student.phone || '',
        photo: student.photo || '',
        address: student.address || '',
        emergencyContact: student.emergencyContact || '',
        emergencyPhone: student.emergencyPhone || '',
        department: student.department || '',
        program: student.program || '',
        level: student.level || '',
      });
    }
    setEditing(false);
    setSuccess(false);
  };

  if (!student) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-slate-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">My Profile</h1>
          <p className="mt-1 text-sm text-slate-400">Manage your personal information</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            Edit Profile
          </button>
        )}
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 size={16} />
          Academic information updated successfully.
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <StudentAvatar photo={student.photo} firstName={student.firstName} lastName={student.lastName} size="xl" />
              {editing && (
                <button className="absolute bottom-0 right-0 rounded-full bg-cyan-500 p-2 text-white hover:bg-cyan-600 transition">
                  <Camera size={16} />
                </button>
              )}
            </div>

            <h2 className="text-2xl font-semibold text-white">
              {student.firstName} {student.lastName}
            </h2>
            <p className="text-slate-400">{student.apogee}</p>
            <p className="text-sm text-slate-400">{student.department}</p>

            <div className="mt-4 flex gap-2">
              <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-300">
                {student.status}
              </div>
              <div className={`rounded-full px-3 py-1 text-sm font-medium ${student.rfidUID ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                {student.rfidUID ? 'RFID Assigned' : 'No RFID Assigned'}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-400">Student ID</p>
              <p className="font-medium text-white">{student.studentId || '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-400">University Reg. No.</p>
              <p className="font-medium text-white">{student.universityRegNumber || (student as any).universityRegistrationNumber || '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-400">RFID UID</p>
              <p className="font-mono font-medium text-white">{student.rfidUID || 'No RFID Assigned'}</p>
            </div>
          </div>
        </motion.div>

        {/* Editable Fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Contact Information */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Contact Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <Mail size={18} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-white">{student.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <Phone size={18} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Phone</p>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-transparent text-white outline-none"
                    />
                  ) : (
                    <p className="text-white">{student.phone || '—'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <MapPin size={18} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Address</p>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-transparent text-white outline-none"
                    />
                  ) : (
                    <p className="text-white">{student.address || '—'}</p>
                  )}
                </div>
              </div>

              {editing && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <Camera size={18} className="text-slate-400" />
                  <div className="flex-1"><ProfileImageUpload file={photoFile} onChange={setPhotoFile} onError={setPhotoError} disabled={loading}/>{photoError&&<p className="mt-2 text-sm text-rose-300">{photoError}</p>}</div>
                </div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Emergency Contact</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <User size={18} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Contact Name</p>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                      className="w-full bg-transparent text-white outline-none"
                    />
                  ) : (
                    <p className="text-white">{student.emergencyContact || '—'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <Phone size={18} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Emergency Phone</p>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                      className="w-full bg-transparent text-white outline-none"
                    />
                  ) : (
                    <p className="text-white">{student.emergencyPhone || '—'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Academic Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">Department</p>
                {editing?<select value={formData.department} onChange={e=>setFormData({...formData,department:e.target.value,program:''})} className="mt-1 w-full bg-transparent text-white outline-none"><option value="" className="bg-slate-900">Select department</option>{departments.map(v=><option className="bg-slate-900" key={v}>{v}</option>)}</select>:<p className="font-medium text-white">{student.department}</p>}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">Program / Filière</p>
                {editing?<select value={formData.program} onChange={e=>setFormData({...formData,program:e.target.value})} className="mt-1 w-full bg-transparent text-white outline-none"><option value="" className="bg-slate-900">Select program</option>{(programsByDepartment[formData.department]||[]).map(v=><option className="bg-slate-900" key={v}>{v}</option>)}</select>:<p className="font-medium text-white">{student.program||'Programme non renseigné'}</p>}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">Study Level</p>
                {editing?<select value={formData.level} onChange={e=>setFormData({...formData,level:e.target.value})} className="mt-1 w-full bg-transparent text-white outline-none"><option value="" className="bg-slate-900">Select level</option>{levels.map(v=><option className="bg-slate-900" key={v}>{v}</option>)}</select>:<p className="font-medium text-white">{student.level}</p>}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">Attendance</p>
                <p className="font-medium text-white">{student.attendance || 0}%</p>
              </div>
            </div>
          </div>

          {editing && (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-600 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
              >
                <X size={18} />
                Cancel
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Read-only Fields Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-3"
      >
        <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
        <div className="text-sm text-amber-200">
          <p className="font-medium">Read-only Fields</p>
          <p className="mt-1">
            Apogee number, RFID UID, Student ID, University Registration Number, and role cannot be modified. 
            Contact administration for changes to these fields.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
