declare module '../firebase.js' {
  import type { Firestore } from 'firebase/firestore';
  export const db: Firestore;
}
