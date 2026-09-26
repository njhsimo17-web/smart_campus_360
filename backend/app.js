const express = require("express");
const cors = require("cors");

const ACTIVE = "En cours";
const COMPLETED = "Terminée";
const normalize = value => String(value || "").trim().toLocaleLowerCase("en");
const httpError = (status, code, message) => Object.assign(new Error(message), { status, code });
const roomLockId = room => Buffer.from(normalize(room), "utf8").toString("base64url");

function createApp({ db, FieldValue, verifyIdToken = async () => null }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => res.json({ success: true, message: "Smart Campus API connected to Firebase." }));
  app.get("/api/test-firestore", async (req, res, next) => {
    try {
      await db.collection("backendTests").doc().create({ message: "Backend Firebase connection succeeded.", createdAt: FieldValue.serverTimestamp() });
      return res.json({ success: true, message: "Firestore test document created." });
    } catch (error) { next(error); }
  });

  app.use(async (req, res, next) => {
    if (!["/api/sessions/start", "/api/sessions/finish"].includes(req.path)) return next();
    try {
      const token = /^Bearer (.+)$/.exec(req.get("authorization") || "")?.[1];
      if (!token) throw httpError(401, "UNAUTHORIZED", "Authentication is required.");
      req.identity = await verifyIdToken(token);
      if (!req.identity?.uid) throw httpError(401, "UNAUTHORIZED", "Authentication is required.");
      const account = await db.collection("users").doc(req.identity.uid).get();
      if (!account.exists || account.data().role !== "professor") throw httpError(403, "FORBIDDEN", "Professor access is required.");
      next();
    } catch (error) { next(error); }
  });

  app.get("/api/sessions/active", async (req, res, next) => {
    try {
      const room = String(req.query.room || "").trim();
      if (!room) throw httpError(400, "ROOM_REQUIRED", "Room is required.");
      const lock = await db.collection("sessionRoomLocks").doc(roomLockId(room)).get();
      if (!lock.exists || normalize(lock.data().room) !== normalize(room) || !lock.data().sessionId) {
        return res.json({ success: true, session: null });
      }
      const sessionDoc = await db.collection("attendanceSessions").doc(lock.data().sessionId).get();
      if (!sessionDoc.exists || sessionDoc.data().status !== ACTIVE || normalize(sessionDoc.data().room) !== normalize(room)) {
        return res.json({ success: true, session: null });
      }
      const session = sessionDoc.data();
      return res.json({ success: true, session: { id: sessionDoc.id, room: session.room, filiere: session.filiere, niveau: session.niveau, professorName: session.professorName, status: session.status } });
    } catch (error) { next(error); }
  });

  app.post("/api/sessions/start", async (req, res, next) => {
    try {
      const { room, filiere, niveau, professorName, date, startTime } = req.body || {};
      if (![room, filiere, niveau].every(value => typeof value === "string" && value.trim())) {
        throw httpError(400, "INVALID_SESSION", "Room, program, and level are required.");
      }
      const cleanRoom = room.trim();
      const sessionRef = db.collection("attendanceSessions").doc();
      const lockRef = db.collection("sessionRoomLocks").doc(roomLockId(cleanRoom));
      await db.runTransaction(async tx => {
        const lock = await tx.get(lockRef);
        if (lock.exists && lock.data().sessionId) {
          const currentRef = db.collection("attendanceSessions").doc(lock.data().sessionId);
          const current = await tx.get(currentRef);
          if (current.exists && current.data().status === ACTIVE && normalize(current.data().room) === normalize(cleanRoom)) {
            throw httpError(409, "ROOM_SESSION_ACTIVE", "An active session already exists in this room.");
          }
        }
        tx.set(sessionRef, {
          date: date || "", startTime: startTime || "", filiere: filiere.trim(), niveau: niveau.trim(), room: cleanRoom,
          professorId: req.identity.uid, professorName: String(professorName || "").trim(), status: ACTIVE,
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.set(lockRef, { room: cleanRoom, sessionId: sessionRef.id, professorId: req.identity.uid, updatedAt: FieldValue.serverTimestamp() });
      });
      return res.status(201).json({ success: true, session: { id: sessionRef.id, room: cleanRoom, filiere: filiere.trim(), niveau: niveau.trim(), professorName: String(professorName || "").trim(), status: ACTIVE } });
    } catch (error) { next(error); }
  });

  app.post("/api/sessions/finish", async (req, res, next) => {
    try {
      const { sessionId, endTime } = req.body || {};
      if (!sessionId) throw httpError(400, "SESSION_ID_REQUIRED", "Session ID is required.");
      const sessionRef = db.collection("attendanceSessions").doc(String(sessionId));
      await db.runTransaction(async tx => {
        const sessionDoc = await tx.get(sessionRef);
        if (!sessionDoc.exists || sessionDoc.data().professorId !== req.identity.uid) throw httpError(404, "SESSION_NOT_FOUND", "Session was not found.");
        const session = sessionDoc.data();
        const lockRef = db.collection("sessionRoomLocks").doc(roomLockId(session.room || ""));
        const lock = await tx.get(lockRef);
        if (session.status !== ACTIVE) throw httpError(409, "SESSION_CLOSED", "Session is already completed.");
        tx.update(sessionRef, { status: COMPLETED, endTime: endTime || "", endedAt: FieldValue.serverTimestamp() });
        if (lock.exists && lock.data().sessionId === sessionDoc.id) tx.delete(lockRef);
      });
      return res.json({ success: true, sessionId, status: COMPLETED, message: "Session ended." });
    } catch (error) { next(error); }
  });

  app.post("/api/rfid/scan", async (req, res, next) => {
    try {
      const { sessionId, rfidUID, event, room, deviceId } = req.body || {};
      if (typeof sessionId !== "string" || !sessionId.trim()) throw httpError(409, "NO_ACTIVE_SESSION", "No active session.");
      if (![rfidUID, event, room].every(value => typeof value === "string" && value.trim())) throw httpError(400, "INVALID_SCAN", "Badge UID, event, and room are required.");
      if (event !== "ENTRY" && event !== "EXIT") throw httpError(400, "INVALID_EVENT", "Event must be ENTRY or EXIT.");
      const normalizedUID = rfidUID.replace(/\s+/g, "").toUpperCase();
      const sessionRef = db.collection("attendanceSessions").doc(sessionId);
      const lockRef = db.collection("sessionRoomLocks").doc(roomLockId(room));
      const studentQuery = db.collection("students").where("rfidUID", "==", normalizedUID).limit(1);
      const outcome = await db.runTransaction(async tx => {
        const [sessionDoc, lock, studentSnapshot] = await Promise.all([
          tx.get(sessionRef), tx.get(lockRef), tx.get(studentQuery),
        ]);
        if (!sessionDoc.exists) throw httpError(409, "NO_ACTIVE_SESSION", "No active session.");
        const session = sessionDoc.data();
        if (session.status !== ACTIVE) throw httpError(409, "SESSION_CLOSED", "Session is completed.");
        if (!session.room) throw httpError(409, "NO_ACTIVE_SESSION", "No active session.");
        if (normalize(session.room) !== normalize(room)) throw httpError(409, "ROOM_MISMATCH", "Session room does not match the device room.");
        if (!lock.exists || lock.data().sessionId !== sessionId || normalize(lock.data().room) !== normalize(room)) throw httpError(409, "SESSION_CLOSED", "Session is completed.");
        if (studentSnapshot.empty) return { unknownBadge: true };
        const studentDoc = studentSnapshot.docs[0];
        const studentRef = studentDoc.ref;
        const currentStudent = studentDoc.data();
        const studentId = String(currentStudent.uid || studentDoc.id || currentStudent.apogee || "").trim();
        if (!studentId) throw httpError(409, "STUDENT_NOT_ELIGIBLE", "Student is not eligible for this session.");
        const attendanceRef = db.collection("attendance").doc(`${sessionId}_${studentId}`);
        const attendanceDoc = await tx.get(attendanceRef);
        if (normalize(currentStudent.program || currentStudent.department || currentStudent.filiere) !== normalize(session.filiere)
          || normalize(currentStudent.level || currentStudent.niveau || currentStudent.studyLevel) !== normalize(session.niveau)) {
          throw httpError(403, "STUDENT_NOT_ELIGIBLE", "Student is not eligible for this session.");
        }
        if (event === "EXIT" && (!attendanceDoc.exists || !attendanceDoc.data().entryTime)) throw httpError(409, "EXIT_WITHOUT_ENTRY", "An entry scan is required before exit.");
        const fullName = `${currentStudent.firstName || ""} ${currentStudent.lastName || ""}`.trim();
        if (event === "ENTRY") {
          if (!attendanceDoc.exists) tx.create(attendanceRef, {
            sessionId, studentUid: currentStudent.uid || studentId, studentId, studentApogee: currentStudent.apogee || studentDoc.id,
            studentName: fullName, firstName: currentStudent.firstName || "", lastName: currentStudent.lastName || "",
            filiere: session.filiere, department: currentStudent.department || "", program: currentStudent.program || "",
            niveau: session.niveau, level: currentStudent.level || "", rfidUID: normalizedUID,
            entryTime: FieldValue.serverTimestamp(), room: session.room, deviceId: deviceId || "ESP32-01",
            status: "Présent", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
          });
          else tx.update(attendanceRef, { updatedAt: FieldValue.serverTimestamp(), room: session.room, deviceId: deviceId || "ESP32-01" });
          tx.update(studentRef, { present: true, room: session.room, lastEvent: event, lastScanAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        } else {
          tx.update(attendanceRef, { exitTime: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), room: session.room, deviceId: deviceId || "ESP32-01" });
          tx.update(studentRef, { present: false, room: null, lastEvent: event, lastScanAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        }
        return { unknownBadge: false };
      });
      if (outcome.unknownBadge) {
        await db.collection("notifications").doc().create({ type: "unknown_rfid", title: "Unknown RFID badge", message: `Unknown badge detected in ${room}.`, rfidUID: normalizedUID, room, deviceId: deviceId || "ESP32-01", read: false, createdAt: FieldValue.serverTimestamp() });
        throw httpError(404, "UNKNOWN_BADGE", "Unknown badge.");
      }
      return res.json({ success: true, code: event === "ENTRY" ? "ENTRY_RECORDED" : "EXIT_RECORDED", message: event === "ENTRY" ? "Entry recorded." : "Exit recorded." });
    } catch (error) { next(error); }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number(error.status) || 500;
    if (status === 500) console.error("API request failed:", error);
    return res.status(status).json({ success: false, code: error.code || "INTERNAL_ERROR", message: status === 500 ? "Internal server error." : error.message });
  });
  return app;
}

module.exports = { createApp, roomLockId };
