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

let db; let server; let base;
const timestamp = () => "mock-time";
const fetchJson = async (path, options) => { const response = await fetch(`${base}${path}`, options); return { status: response.status, body: await response.json() }; };
const post = (path, body, token) => fetchJson(path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

before(async () => {
  db = new FakeFirestore();
  db.data.set("users/prof-1", { role: "professor" });
  db.data.set("students/P100", { uid: "student-uid-1", apogee: "P100", firstName: "Ada", lastName: "Lovelace", rfidUID: "A1B2", program: "Computer Engineering", level: "Year 1", present: false });
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

test("parallel starts cannot create two active sessions in one room", async () => {
  const body = { room: "Amphi A", filiere: "Computer Engineering", niveau: "Year 1", professorName: "Professor Ada" };
  const results = await Promise.all([post("/api/sessions/start", body, "prof-1"), post("/api/sessions/start", body, "prof-1")]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  const active = await fetchJson("/api/sessions/active?room=Amphi%20A");
  assert.equal(active.body.session.room, "Amphi A");
  assert.equal(active.body.session.professorName, "Professor Ada");
  assert.equal("student" in active.body.session, false);
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
