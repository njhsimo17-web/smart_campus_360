import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { 
  type User as FirebaseUser, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, query, where, limit, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { uploadProfileImage } from '../services/cloudinary';
import type { User, Student, Professor, Admin, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  userRole: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ role: UserRole | null; userData: User | null }>;
  register: (email: string, password: string, userData: Partial<Student>, profileImage?: File | null) => Promise<{ warning?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const findStudentDocument = async (uid: string, email?: string): Promise<Student | null> => {
    const uidQuery = query(collection(db, 'students'), where('uid', '==', uid), limit(1));
    let querySnapshot = await getDocs(uidQuery);
    if (!querySnapshot.empty) {
      return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Student;
    }

    if (email) {
      const emailQuery = query(collection(db, 'students'), where('email', '==', email), limit(1));
      querySnapshot = await getDocs(emailQuery);
      if (!querySnapshot.empty) {
        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Student;
      }
    }

    return null;
  };

  const fetchUserData = async (uid: string): Promise<{ role: UserRole | null; userData: User | null }> => {
    try {
      const usersDoc = await getDoc(doc(db, 'users', uid));
      if (usersDoc.exists()) {
        const userDocData = usersDoc.data() as Partial<User>;
        const role = userDocData.role as UserRole;

        if (role === 'student') {
          const studentDoc = await findStudentDocument(uid, userDocData.email);
          if (studentDoc) {
            setUserData(studentDoc);
            setUserRole('student');
            return { role: 'student', userData: studentDoc as User };
          }
        }

        const data = { id: usersDoc.id, ...userDocData } as User;
        setUserData(data);
        setUserRole(role);
        return { role, userData: data };
      }

      const studentDoc = await findStudentDocument(uid);
      if (studentDoc) {
        setUserData(studentDoc);
        setUserRole('student');
        return { role: 'student', userData: studentDoc as User };
      }

      let otherDoc = await getDoc(doc(db, 'teachers', uid));
      if (otherDoc.exists()) {
        const data = { id: otherDoc.id, ...otherDoc.data() } as Professor;
        setUserData(data);
        setUserRole('professor');
        return { role: 'professor', userData: data as User };
      }

      otherDoc = await getDoc(doc(db, 'admins', uid));
      if (otherDoc.exists()) {
        const data = { id: otherDoc.id, ...otherDoc.data() } as Admin;
        setUserData(data);
        setUserRole('admin');
        return { role: 'admin', userData: data as User };
      }

      setUserData(null);
      setUserRole(null);
      return { role: null, userData: null };
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
      setUserRole(null);
      return { role: null, userData: null };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(true);

      if (user) {
        await fetchUserData(user.uid);
      } else {
        setUserData(null);
        setUserRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    console.log('Login started');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Firebase login success');

    const uid = userCredential.user.uid;
    const accountSnapshot = await getDoc(doc(db, 'users', uid));
    if (!accountSnapshot.exists()) {
      throw new Error('User profile not found in Firestore.');
    }
    const account = accountSnapshot.data();
    console.log('Login profile:', { uid, role: account.role, status: account.status });
    const result = await fetchUserData(uid);
    console.log('User role:', result.role);

    if (!result.role || !result.userData) {
      throw new Error('User profile not found in Firestore.');
    }

    return result;
  };

  const register = async (email: string, password: string, studentData: Partial<Student>, profileImage?: File | null) => {
    console.log('START Registration');
    const normalizedEmail = email.trim();
    const firstName = (studentData.firstName || '').trim();
    const lastName = (studentData.lastName || '').trim();
    const phone = (studentData.phone || '').trim();
    const department = (studentData.department || '').trim();
    const program = (studentData.program || '').trim();
    const level = (studentData.level || '').trim();
    const cleanApogee = (studentData.apogee || '').trim();
    const apogee = cleanApogee;

    if (!normalizedEmail || !firstName || !lastName || !apogee || !department || !level || password.length < 6) {
      const error = new Error('Please complete all required registration fields.');
      (error as Error & { code?: string }).code = 'registration/invalid-fields';
      throw error;
    }
    if (profileImage && (profileImage.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(profileImage.type))) {
      const error = new Error(profileImage.size > 2 * 1024 * 1024 ? 'Image too large. Maximum size is 2 MB.' : 'Unsupported image format.');
      (error as Error & { code?: string }).code = 'registration/invalid-image';
      throw error;
    }

    const logRegistrationError = (error: unknown) => {
      const failure = error as { code?: string; message?: string };
      console.error('Registration error:', { code: failure?.code, message: failure?.message, currentUser: auth.currentUser?.uid });
    };

    console.log('STEP 1 - Checking Apogee');
    const studentRef = doc(db, 'students', cleanApogee);
    try {
      const studentSnapshot = await getDoc(studentRef);
      if (studentSnapshot.exists()) {
        const error = new Error('apogee-already-exists');
        (error as Error & { code?: string }).code = 'apogee-already-exists';
        throw error;
      }
    } catch (error) {
      logRegistrationError(error);
      throw error;
    }

    console.log('STEP 2 - Creating Auth account');
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      logRegistrationError(error);
      const failure = error as { code?: string; message?: string };
      console.error('Registration error code:', failure.code);
      console.error('Registration error message:', failure.message);
      const stepError = new Error(`STEP 2: Creating Auth user failed. ${failure.message || 'Registration failed.'}`);
      (stepError as Error & { code?: string }).code = failure.code || 'registration/auth-failed';
      throw stepError;
    }
    const uid = userCredential.user.uid;
    console.log('Firebase Auth Created', uid);
    console.log('Authenticated UID:', auth.currentUser?.uid);
    if (!auth.currentUser || auth.currentUser.uid !== uid) {
      const error = new Error('authenticated-user-not-ready');
      (error as Error & { code?: string }).code = 'authenticated-user-not-ready';
      logRegistrationError(error);
      console.error('Registration error code:', 'authenticated-user-not-ready');
      console.error('Registration error message:', error.message);
      try { await deleteUser(userCredential.user); } catch (rollbackError) {
        const failure = rollbackError as { code?: string; message?: string };
        console.error('Registration error code:', failure.code);
        console.error('Registration error message:', failure.message);
      }
      throw error;
    }

    let firestoreStep = 'Creating users document';
    try {
      const userDoc = {
        uid,
        email: normalizedEmail,
        firstName,
        lastName,
        role: 'student' as const,
        status: 'pending' as const,
        approved: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('STEP 3 - Creating user document');
      await setDoc(doc(db, 'users', uid), userDoc);
      console.log('Users Document Created', uid);
    } catch (error) {
      logRegistrationError(error);
      const failure = error as { code?: string; message?: string };
      console.error('Registration error code:', failure.code);
      console.error('Registration error message:', failure.message);
      await Promise.allSettled([
        deleteDoc(doc(db, 'users', uid)),
        deleteDoc(studentRef),
      ]);
      try {
        await deleteUser(userCredential.user);
      } catch (deleteError) {
        const failure = deleteError as { code?: string; message?: string };
        console.error('Registration error code:', failure.code);
        console.error('Registration error message:', failure.message);
      }
      const friendlyError = new Error(
        failure.code === 'permission-denied'
          ? `${firestoreStep} failed. Firestore permission denied.`
          : `${firestoreStep} failed. ${failure.message || 'Registration failed. Please try again.'}`
      );
      (friendlyError as Error & { code?: string }).code = failure.code || 'registration/failed';
      throw friendlyError;
    }

    let warning: string | undefined;
    let photo = '';
    if (profileImage) {
      try {
        console.log('STEP 4 - Uploading Cloudinary photo');
        photo = await uploadProfileImage(profileImage);
        console.log('Cloudinary Upload Finished');
      } catch (error) {
        logRegistrationError(error);
        const failure = error as { code?: string; message?: string };
        console.error('Registration error code:', failure.code);
        console.error('Registration error message:', failure.message);
        warning = 'Registration completed without image. Cloudinary upload failed.';
      }
    }

    firestoreStep = 'Creating students document';
    try {
      console.log('STEP 5 - Creating student document');
      await setDoc(studentRef, {
        uid, email: normalizedEmail, firstName, lastName, phone, apogee, department, program, level,
        photo, role: 'student' as const, status: 'pending' as const, approved: false,
        attendance: 0, present: false, rfidUID: null, room: null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      console.log('Students Document Created', apogee);
    } catch (error) {
      logRegistrationError(error);
      const failure = error as { code?: string; message?: string };
      console.error('Registration error code:', failure.code);
      console.error('Registration error message:', failure.message);
      await Promise.allSettled([deleteDoc(doc(db, 'users', uid)), deleteDoc(studentRef)]);
      try { await deleteUser(userCredential.user); } catch (rollbackError) {
        const rollback = rollbackError as { code?: string; message?: string };
        console.error('Registration error code:', rollback.code);
        console.error('Registration error message:', rollback.message);
      }
      const stepError = new Error(`${firestoreStep} failed. ${failure.code === 'permission-denied' ? 'Firestore permission denied.' : failure.message || 'Registration failed.'}`);
      (stepError as Error & { code?: string }).code = failure.code || 'registration/student-profile-failed';
      throw stepError;
    }

    try {
      console.log('STEP 6 - Creating notification');
      await addDoc(collection(db, 'notifications'), {
        type: 'student_registration',
        title: 'New student registration',
        message: `${firstName} ${lastName} requested access`,
        studentUid: uid,
        studentApogee: apogee,
        read: false,
        createdAt: serverTimestamp(),
      });
      console.log('Notification Created');
    } catch (notificationError) {
      logRegistrationError(notificationError);
      const failure = notificationError as { code?: string; message?: string };
      console.error('Registration error code:', failure.code);
      console.error('Registration error message:', failure.message);
      warning = warning || `STEP 6: Creating notification failed. ${failure.message || 'The account was still created successfully.'}`;
    }
    console.log('Registration Finished');
    return { warning };
  };

  const logout = async () => {
    await signOut(auth);
    setUserData(null);
    setUserRole(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshUserData = async () => {
    if (currentUser) {
      await fetchUserData(currentUser.uid);
    }
  };

  const value: AuthContextType = {
    currentUser,
    userData,
    userRole,
    loading,
    login,
    register,
    logout,
    resetPassword,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
