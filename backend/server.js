require("dotenv").config();
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { createApp } = require("./app");

function getFirebaseCredential() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") });
  }
  throw new Error("Missing Firebase Admin configuration. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
}

if (getApps().length === 0) initializeApp({ credential: getFirebaseCredential() });
const db = getFirestore();
const app = createApp({ db, FieldValue, verifyIdToken: token => getAuth().verifyIdToken(token) });
const port = process.env.PORT || 3002;
app.listen(port, () => console.log(`Smart Campus API listening on port ${port}`));
