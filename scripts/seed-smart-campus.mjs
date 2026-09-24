import admin from 'firebase-admin';

const professorUid = process.env.PROFESSOR_UID || process.argv[2];
if (!professorUid) throw new Error('Set PROFESSOR_UID or pass the real professor UID as the first argument.');
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey,
}) });
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();
const records = [
  ['classrooms','AMPHI-A',{name:'Amphi A',room:'Amphi A',capacity:120,active:true,updatedAt:now,createdAt:now}],
  ['classes','M1-EMBEDDED-SYSTEMS',{name:'Master 1 Électronique Embarquée',course:'Systèmes embarqués',department:'Physique',program:'Électronique Embarquée',level:'Master 1',room:'Amphi A',professorUid,schedule:'Lundi 08:30 - 10:30',active:true,updatedAt:now,createdAt:now}],
  ['courseAssignments',`M1-EMBEDDED-SYSTEMS-${professorUid}`,{classId:'M1-EMBEDDED-SYSTEMS',course:'Systèmes embarqués',professorUid,active:true,updatedAt:now,createdAt:now}],
  ['devices','ESP32-AMPHI-A',{deviceId:'ESP32-AMPHI-A',name:'Terminal Amphi A',room:'Amphi A',type:'ESP32_RFID',online:true,lastSeenAt:now,firmwareVersion:'1.0.0',updatedAt:now,createdAt:now}],
];
const batch=db.batch();
for(const [collection,id,data] of records){const ref=db.collection(collection).doc(id);if(!(await ref.get()).exists)batch.create(ref,data)}
await batch.commit();
console.log('Development seed completed without creating duplicates.');
