const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../app");

class FakeFirestore {
  constructor() { this.data = new Map(); this.counter = 0; this.queue = Promise.resolve(); this.failGetPath = null; }
  collection(name) { return new FakeCollection(this, name); }
  async runTransaction(callback) {
    let release;
    const previous = this.queue;
    this.queue = new Promise(resolve => { release = resolve; });
    await previous;
    const writes = [];
    const tx = {
      get: async ref => ref.get(),
      set: (ref, value) => writes.push(() => this.data.set(ref.path, structuredClone(value))),
      create: (ref, value) => writes.push(() => { if (this.data.has(ref.path)) throw new Error("already exists"); this.data.set(ref.path, structuredClone(value)); }),
      update: (ref, value) => writes.push(() => { if (!this.data.has(ref.path)) throw new Error("missing document"); this.data.set(ref.path, { ...this.data.get(ref.path), ...structuredClone(value) }); }),
      delete: ref => writes.push(() => this.data.delete(ref.path)),
    };
    try { const result = await callback(tx); writes.forEach(write => write()); return result; }
    finally { release(); }
  }
}
class FakeCollection {
  constructor(db, name) { this.db = db; this.name = name; }
  doc(id) { return new FakeRef(this.db, `${this.name}/${id || `generated-${++this.db.counter}`}`, id || `generated-${this.db.counter}`); }
  where(field, operator, value) { return { limit: () => ({ get: async () => {
    const docs = [...this.db.data.entries()].filter(([path, data]) => path.startsWith(`${this.name}/`) && data[field] === value).slice(0, 1)
      .map(([path, data]) => ({ id: path.split("/").at(-1), ref: new FakeRef(this.db, path, path.split("/").at(-1)), data: () => structuredClone(data) }));
    return { empty: docs.length === 0, docs };
  } }) }; }
}
class FakeRef {
  constructor(db, path, id) { this.db = db; this.path = path; this.id = id; }
  async get() { if (this.db.failGetPath === this.path) { this.db.failGetPath = null; throw new Error("mock Firestore unavailable"); } const data = this.db.data.get(this.path); return { id: this.id, exists: !!data, data: () => data && structuredClone(data), ref: this }; }
  async create(value) { if (this.db.data.has(this.path)) throw new Error("already exists"); this.db.data.set(this.path, structuredClone(value)); }
}

let db; let server; let base; let academic;
const timestamp = () => "mock-time";
const fetchJson = async (path, options) => { const response = await fetch(`${base}${path}`, options); return { status: response.status, body: await response.json() }; };
const post = (path, body, token) => fetchJson(path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

before(async () => {
  db = new FakeFirestore();
  academic = await import("../academic-normalization.mjs");
  db.data.set("users/prof-1", { role: "professor" });
  db.data.set("students/P100", { uid: "student-uid-1", apogee: "P100", firstName: "Ada", lastName: "Lovelace", rfidUID: "A1B2", department: "Computing", program: "Computer Engineering", level: "Year 1", present: false });
  const app = createApp({ db, FieldValue: { serverTimestamp: timestamp }, verifyIdToken: async token => ({ uid: token }) });
  server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => new Promise(resolve => server.close(resolve)));

test("active session endpoint returns null only when no active session exists", async () => {
  const none = await fetchJson("/api/sessions/active?room=Amphi%20A");
  assert.deepEqual(none.body, { success: true, session: null });
  assert.equal((await fetchJson("/api/sessions/active")).status, 400);
  assert.equal((await post("/api/rfid/scan", { rfidUID: "A1B2", event: "ENTRY", room: "Amphi A" })).body.code, "NO_ACTIVE_SESSION");
  const { roomLockId } = require("../app");
  db.failGetPath = `sessionRoomLocks/${roomLockId("Amphi A")}`;
  const originalError = console.error;
  console.error = () => {};
  const failure = await fetchJson("/api/sessions/active?room=Amphi%20A");
  console.error = originalError;
  assert.equal(failure.status, 500);
  assert.equal(failure.body.success, false);
});

test("session start requires the explicit academic hierarchy and room", async () => {
  const legacyBody = { room: "Validation Room", filiere: "Physique", niveau: "Master 1" };
  const response = await post("/api/sessions/start", legacyBody, "prof-1");
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_SESSION");
  assert.equal([...db.data.keys()].some(key => key.startsWith("attendanceSessions/")), false);
});

test("parallel starts cannot create two active sessions in one room", async () => {
  const body = { room: "Amphi A", department: "Computing", program: "Computer Engineering", level: "Year 1", professorName: "Professor Ada" };
  const results = await Promise.all([post("/api/sessions/start", body, "prof-1"), post("/api/sessions/start", body, "prof-1")]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  const created = results.find(result => result.status === 201).body.session;
  assert.equal(created.department, "Computing");
  assert.equal(created.program, "Computer Engineering");
  assert.equal(created.level, "Year 1");
  assert.equal(created.filiere, created.program);
  assert.equal(created.niveau, created.level);
  const active = await fetchJson("/api/sessions/active?room=Amphi%20A");
  assert.equal(active.body.session.room, "Amphi A");
  assert.equal(active.body.session.professorName, "Professor Ada");
  assert.equal(active.body.session.department, "Computing");
  assert.equal(active.body.session.program, "Computer Engineering");
  assert.equal(active.body.session.filiere, active.body.session.program);
  assert.equal("student" in active.body.session, false);
  assert.equal((await post("/api/sessions/start", { ...body, filiere: "Computing" }, "prof-1")).body.code, "INVALID_SESSION");
});

test("unknown badge, mismatched room, and ineligible student cannot change presence", async () => {
  const active = (await fetchJson("/api/sessions/active?room=Amphi%20A")).body.session;
  const before = structuredClone(db.data.get("students/P100"));
  assert.equal((await post("/api/rfid/scan", { sessionId: active.id, rfidUID: "NOPE", event: "ENTRY", room: "Amphi A" })).body.code, "UNKNOWN_BADGE");
  assert.equal((await post("/api/rfid/scan", { sessionId: active.id, rfidUID: "A1B2", event: "ENTRY", room: "Room B" })).body.code, "ROOM_MISMATCH");
  db.data.set("students/P100", { ...before, level: "Year 2" });
  assert.equal((await post("/api/rfid/scan", { sessionId: active.id, rfidUID: "A1B2", event: "ENTRY", room: "Amphi A" })).body.code, "STUDENT_NOT_ELIGIBLE");
  assert.equal(db.data.has(`attendance/${active.id}_student-uid-1`), false);
  assert.equal(db.data.get("students/P100").present, false);
  db.data.set("students/P100", before);
});

test("missing or closed session and invalid event are rejected", async () => {
  const before = structuredClone(db.data.get("students/P100"));
  const scan = body => post("/api/rfid/scan", body);
  assert.equal((await scan({ sessionId: "missing", rfidUID: "A1B2", event: "ENTRY", room: "Amphi A" })).body.code, "NO_ACTIVE_SESSION");
  const active = (await fetchJson("/api/sessions/active?room=Amphi%20A")).body.session;
  assert.equal((await scan({ sessionId: active.id, rfidUID: "A1B2", event: "ARRIVAL", room: "Amphi A" })).body.code, "INVALID_EVENT");
  assert.deepEqual(db.data.get("students/P100"), before);
  assert.equal(db.data.has(`attendance/${active.id}_student-uid-1`), false);
});

test("exit before entry is refused; repeated entry remains one attendance with its first entry", async () => {
  const active = (await fetchJson("/api/sessions/active?room=Amphi%20A")).body.session;
  const scan = body => post("/api/rfid/scan", body);
  const payload = { sessionId: active.id, rfidUID: " a1 b2 ", room: "Amphi A" };
  assert.equal((await scan({ ...payload, event: "EXIT" })).body.code, "EXIT_WITHOUT_ENTRY");
  assert.equal((await scan({ ...payload, event: "ENTRY" })).status, 200);
  const attendancePath = `attendance/${active.id}_student-uid-1`;
  const firstEntry = db.data.get(attendancePath).entryTime;
  await scan({ ...payload, event: "ENTRY" });
  assert.equal(db.data.get(attendancePath).entryTime, firstEntry);
  assert.equal([...db.data.keys()].filter(key => key.startsWith(`attendance/${active.id}_`)).length, 1);
  assert.equal((await scan({ ...payload, event: "EXIT" })).status, 200);
});

test("finishing releases the room and closed sessions reject scans", async () => {
  const active = (await fetchJson("/api/sessions/active?room=Amphi%20A")).body.session;
  const finish = await post("/api/sessions/finish", { sessionId: active.id, endTime: "10:00" }, "prof-1");
  assert.equal(finish.body.status, "Terminée");
  assert.deepEqual((await fetchJson("/api/sessions/active?room=Amphi%20A")).body, { success: true, session: null });
  assert.equal((await post("/api/rfid/scan", { sessionId: active.id, rfidUID: "A1B2", event: "ENTRY", room: "Amphi A" })).body.code, "SESSION_CLOSED");
});

test("legacy sessions without a room never activate a device", async () => {
  db.data.set("attendanceSessions/legacy", { status: "En cours", filiere: "Computer Engineering", niveau: "Year 1" });
  assert.deepEqual((await fetchJson("/api/sessions/active?room=Amphi%20A")).body, { success: true, session: null });
});

test("shared academic normalization preserves the department-program-level hierarchy", () => {
  const session = {
    department: "Physique",
    program: "Électronique Embarquée",
    level: "Master 1",
    filiere: "Électronique Embarquée",
    niveau: "Master 1",
  };
  const student = {
    department: "Physique",
    program: "e\u0301lectronique   embarque\u0301e",
    level: "  MASTER   1 ",
  };
  assert.equal(academic.isStudentEligibleForSession(student, session), true);
  assert.equal(academic.isStudentEligibleForSession({ ...student, program: "Énergies Renouvelables" }, session), false);
  assert.equal(academic.isStudentEligibleForSession({ ...student, department: "Chimie" }, session), false);
  assert.equal(academic.isStudentEligibleForSession({ ...student, level: "Master 2" }, session), false);
  assert.equal(academic.isStudentEligibleForSession({ ...student, program: "Physique" }, session), false);
  assert.equal(academic.normalizeAcademicValue("Électronique Embarquée"), academic.normalizeAcademicValue("e\u0301lectronique   embarque\u0301e"));
  assert.notEqual(academic.normalizeAcademicValue("Électronique Embarquée"), academic.normalizeAcademicValue("Énergies Renouvelables"));
});

test("example badge is eligible only for the exact department, program, and level", async () => {
  const sessionBody = {
    room: "Academic Test Room",
    department: "Physique",
    program: "Électronique Embarquée",
    level: "Master 1",
    professorName: "Professor Ada",
  };
  const started = await post("/api/sessions/start", sessionBody, "prof-1");
  assert.equal(started.status, 201);
  const session = started.body.session;
  const profile = {
    uid: "student-uid-c0ffee99",
    apogee: "P200",
    firstName: "Ada",
    lastName: "Student",
    department: "Physique",
    program: "Électronique Embarquée",
    level: "Master 1",
    rfidUID: "C0FFEE99",
    present: false,
  };
  db.data.set("students/P200", profile);
  const payload = { sessionId: session.id, rfidUID: "C0FFEE99", event: "ENTRY", room: session.room };
  const attendancePath = `attendance/${session.id}_${profile.uid}`;

  for (const mismatch of [
    { program: "Énergies Renouvelables" },
    { department: "Chimie" },
    { level: "Master 2" },
  ]) {
    db.data.set("students/P200", { ...profile, ...mismatch, present: false });
    const response = await post("/api/rfid/scan", payload);
    assert.equal(response.body.code, "STUDENT_NOT_ELIGIBLE");
    assert.equal(db.data.has(attendancePath), false);
    assert.equal(db.data.get("students/P200").present, false);
  }

  const normalizedProfile = {
    ...profile,
    program: "e\u0301lectronique   embarque\u0301e",
    level: "  MASTER   1 ",
  };
  db.data.set("students/P200", normalizedProfile);
  const accepted = await post("/api/rfid/scan", payload);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.code, "ENTRY_RECORDED");
  assert.equal(db.data.get(attendancePath).department, "Physique");
  assert.equal(db.data.get(attendancePath).program, "Électronique Embarquée");
  assert.equal(db.data.get(attendancePath).level, "Master 1");

  await post("/api/sessions/finish", { sessionId: session.id }, "prof-1");
});

test("legacy active sessions stay visible to their owner but never enable scans", async () => {
  const { roomLockId } = require("../app");
  const room = "Legacy Room";
  const legacySession = { room, filiere: "Physique", niveau: "Master 1", professorId: "prof-1", professorName: "Professor Ada", status: "En cours" };
  db.data.set("attendanceSessions/legacy-active", legacySession);
  db.data.set(`sessionRoomLocks/${roomLockId(room)}`, { room, sessionId: "legacy-active", professorId: "prof-1" });
  db.data.set("students/LEGACY", { uid: "legacy-student", department: "Physique", program: "", level: "Master 1", rfidUID: "C0FFEE99", present: false });

  assert.deepEqual((await fetchJson(`/api/sessions/active?room=${encodeURIComponent(room)}`)).body, { success: true, session: null });
  const scan = await post("/api/rfid/scan", { sessionId: "legacy-active", rfidUID: "C0FFEE99", event: "ENTRY", room });
  assert.equal(scan.body.code, "SESSION_RECREATE_REQUIRED");
  assert.equal(db.data.get("students/LEGACY").present, false);
  assert.equal([...db.data.keys()].some(key => key.startsWith("attendance/legacy-active_")), false);

  const ended = await post("/api/sessions/finish", { sessionId: "legacy-active", endTime: "11:00" }, "prof-1");
  assert.equal(ended.status, 200);
  assert.equal(db.data.get("attendanceSessions/legacy-active").status, "Terminée");
  assert.equal(db.data.has(`sessionRoomLocks/${roomLockId(room)}`), false);
});
