const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function getFirebaseCredential() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  const localKeyPath = path.join(__dirname, "serviceAccountKey.json");
  if (process.env.NODE_ENV !== "production" && fs.existsSync(localKeyPath)) {
    console.warn("Using local serviceAccountKey.json. Configure Firebase environment variables for production.");
    return cert(require(localKeyPath));
  }

  throw new Error("Missing Firebase Admin configuration. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
}

// Évite d'initialiser Firebase plusieurs fois
if (getApps().length === 0) {
  initializeApp({
    credential: getFirebaseCredential(),
  });
}

const db = getFirestore();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Campus API connectée à Firebase !",
  });
});

app.get("/api/test-firestore", async (req, res) => {
  try {
    await db.collection("backendTests").add({
      message: "Connexion backend Firebase réussie",
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: "Document ajouté dans Firestore",
    });
  } catch (error) {
    console.error("Erreur Firestore :", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

const PORT = process.env.PORT || 3002;

app.post("/api/rfid/scan", async (req, res) => {
  try {
    const { rfidUID, event, room, deviceId } = req.body;

    if (!rfidUID || !event || !room) {
      return res.status(400).json({
        success: false,
        message: "rfidUID, event et room sont obligatoires",
      });
    }

    const normalizedUID = String(rfidUID)
      .replace(/\s+/g, "")
      .toUpperCase();

    const studentsSnapshot = await db
      .collection("students")
      .where("rfidUID", "==", normalizedUID)
      .limit(1)
      .get();

    if (studentsSnapshot.empty) {
      await db.collection("notifications").add({
        type: "unknown_rfid",
        title: "Badge RFID inconnu",
        message: `Badge ${normalizedUID} détecté dans ${room}`,
        rfidUID: normalizedUID,
        room,
        deviceId: deviceId || "ESP32-01",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      return res.status(404).json({
        success: false,
        message: "Badge inconnu",
      });
    }

    const studentDoc = studentsSnapshot.docs[0];
    const student = studentDoc.data();

    const isEntry = event === "ENTRY";

    // Keep the existing raw RFID workflow, but attach a scan to the newest
    // matching active professor session when there is one.  A deterministic
    // document id makes one student appear only once in a session.
    const activeSessions = await db.collection("attendanceSessions")
      .where("status", "==", "En cours").get();
    const studentFiliere = String(student.program || student.department || "").trim().toLowerCase();
    const studentNiveau = String(student.level || "").trim().toLowerCase();
    const sessionDoc = activeSessions.docs.find(item => {
      const session = item.data();
      return String(session.filiere || "").trim().toLowerCase() === studentFiliere
        && String(session.niveau || "").trim().toLowerCase() === studentNiveau;
    });

    if (sessionDoc) {
      const session = sessionDoc.data();
      const attendanceRef = db.collection("attendance").doc(`${sessionDoc.id}_${student.uid || student.apogee}`);
      const existing = await attendanceRef.get();
      if (isEntry && !existing.exists) {
        await attendanceRef.set({
          sessionId: sessionDoc.id,
          studentUid: student.uid,
          studentApogee: student.apogee,
          studentName: `${student.firstName} ${student.lastName}`,
          firstName: student.firstName || "",
          lastName: student.lastName || "",
          filiere: session.filiere || student.program || student.department || "",
          department: student.department || "",
          program: student.program || "",
          niveau: session.niveau || student.level || "",
          level: student.level || "",
          rfidUID: normalizedUID,
          entryTime: FieldValue.serverTimestamp(),
          room,
          deviceId: deviceId || "ESP32-01",
          status: "Présent",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (!isEntry && existing.exists) {
        await attendanceRef.update({ exitTime: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), room, deviceId: deviceId || "ESP32-01" });
      }
    } else {
      // No professor session: preserve the legacy live event log for admin RFID monitoring.
      await db.collection("attendance").add({
        studentUid: student.uid, studentApogee: student.apogee,
        studentName: `${student.firstName} ${student.lastName}`,
        department: student.department || "", program: student.program || "", level: student.level || "",
        rfidUID: normalizedUID, event, room, deviceId: deviceId || "ESP32-01", createdAt: FieldValue.serverTimestamp(),
      });
    }

    await studentDoc.ref.update({
      present: isEntry,
      room: isEntry ? room : null,
      lastEvent: event,
      lastScanAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: isEntry ? "Entrée enregistrée" : "Sortie enregistrée",
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        apogee: student.apogee,
      },
    });
  } catch (error) {
    console.error("Erreur RFID :", error);

    return res.status(500).json({
      success: false,
      message: "Erreur interne du serveur",
    });
  }
});

app.listen(PORT, () => {
  console.log("==================================");
  console.log(" Smart Campus Backend démarré");
  console.log(` http://localhost:${PORT}`);
  console.log("==================================");
});
