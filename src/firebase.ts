import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDYPwDQmT9FBSI9QMBxlnBnbPaaVT7i_X8',
  authDomain: 'smartcompus-d5cb4.firebaseapp.com',
  projectId: 'smartcompus-d5cb4',
  storageBucket: 'smartcompus-d5cb4.firebasestorage.app',
  messagingSenderId: '947528780360',
  appId: '1:947528780360:web:b224fcb548aaa6e69ca67d',
  measurementId: 'G-DBK2WBLTQ6',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { 
  db, 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged 
};
