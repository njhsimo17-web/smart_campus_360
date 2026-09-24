// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDYPwDQmT9FBSI9QMBxlnBnbPaaVT7i_X8",
  authDomain: "smartcompus-d5cb4.firebaseapp.com",
  projectId: "smartcompus-d5cb4",
  storageBucket: "smartcompus-d5cb4.firebasestorage.app",
  messagingSenderId: "947528780360",
  appId: "1:947528780360:web:b224fcb548aaa6e69ca67d",
  measurementId: "G-DBK2WBLTQ6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, db };