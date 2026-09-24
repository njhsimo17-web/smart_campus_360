import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface StudentAttendanceRecord {
  id: string;
  studentUid?: string;
  studentApogee?: string;
  studentName?: string;
  department?: string;
  program?: string;
  level?: string;
  room?: string;
  event?: 'ENTRY' | 'EXIT';
  rfidUID?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
}

const millis = (record: StudentAttendanceRecord) => record.createdAt?.toDate?.().getTime() ?? (record.createdAt?.seconds ?? 0) * 1000;

export function useStudentAttendance(uid?: string) {
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) { setRecords([]); setLoading(false); return; }
    setLoading(true);
    const unsubscribe = onSnapshot(query(collection(db, 'attendance'), where('studentUid', '==', uid)), snapshot => {
      setRecords(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => millis(b) - millis(a)));
      setError(''); setLoading(false);
    }, listenerError => {
      console.error('Attendance listener error (attendance):', listenerError);
      setError('Unable to load attendance records.'); setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);

  return useMemo(() => ({ records, loading, error, latest: records[0] }), [records, loading, error]);
}
