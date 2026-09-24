import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'smartcompus-d5cb4';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const migrationRef = db.doc('_migrations/normalize_student_departments_v1');

function normalizeDepartment(department) {
  if (!department) return 'Unknown';
  const value = String(department).trim().toLowerCase();
  const map = {
    physique: 'Physique', chimie: 'Chimie', informatique: 'Informatique',
    mathematiques: 'Mathématiques', mathématiques: 'Mathématiques',
    electronique: 'Électronique', électronique: 'Électronique',
    energie: 'Énergie', énergie: 'Énergie',
  };
  return map[value] || value.charAt(0).toUpperCase() + value.slice(1);
}

async function main() {
  const previousRun = await migrationRef.get();
  if (previousRun.exists) {
    console.log('Migration already completed; no documents were changed.');
    return;
  }

  const snapshot = await db.collection('students').get();
  const changes = snapshot.docs.flatMap((studentDoc) => {
    const current = studentDoc.data().department;
    const normalized = normalizeDepartment(current);
    return current === normalized ? [] : [{ ref: studentDoc.ref, current, normalized }];
  });

  for (let index = 0; index < changes.length; index += 450) {
    const batch = db.batch();
    for (const change of changes.slice(index, index + 450)) batch.update(change.ref, { department: change.normalized });
    await batch.commit();
  }

  await migrationRef.create({ completedAt: FieldValue.serverTimestamp(), scanned: snapshot.size, updated: changes.length });
  console.log(`Migration complete. Scanned: ${snapshot.size}; updated: ${changes.length}.`);
}

main().catch((error) => {
  console.error('Department migration failed:', error?.code, error?.message);
  process.exitCode = 1;
});
