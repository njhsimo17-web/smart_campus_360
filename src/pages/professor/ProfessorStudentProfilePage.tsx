import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../../firebase";
import StudentAvatar from "../../components/StudentAvatar";

type Row = Record<string, unknown> & { id: string };
const panel =
  "rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20";
const value = (row: Row | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const result = row?.[key];
    if (result !== undefined && result !== null && result !== "") return result;
  }
  return "";
};
const asDate = (input: unknown) => {
  const candidate = input as { toDate?: () => Date };
  const date =
    candidate?.toDate?.() ?? (input ? new Date(String(input)) : null);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const dateText = (input: unknown) => asDate(input)?.toLocaleDateString() || "—";
const timeText = (input: unknown) => {
  if (typeof input === "string") return input;
  return (
    asDate(input)?.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) || "—"
  );
};
const statusOf = (row: Row) =>
  String(value(row, "status", "attendanceStatus") || "Present");

export default function ProfessorStudentProfilePage() {
  const { apogee: routeApogee } = useParams();
  const apogee = decodeURIComponent(routeApogee || "");
  const navigate = useNavigate();
  const [student, setStudent] = useState<Row | null>(null),
    [records, setRecords] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [missing, setMissing] = useState(false),
    [profileError, setProfileError] = useState(""),
    [, setAttendanceUnavailable] = useState(false);
  useEffect(() => {
    if (!apogee) {
      setMissing(true);
      setLoading(false);
      return;
    }
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        doc(db, "students", apogee),
        (snapshot) => {
          if (!snapshot.exists()) {
            setMissing(true);
            setStudent(null);
          } else {
            setMissing(false);
            setProfileError("");
            setStudent({ id: snapshot.id, ...snapshot.data() });
          }
          setLoading(false);
        },
        (error) => {
          console.error("Student profile Firestore error:", error);
          setProfileError(error.message);
          setLoading(false);
        },
      );
    } catch (error) {
      console.error("Student profile Firestore error:", error);
      setProfileError(
        error instanceof Error
          ? error.message
          : "Unable to load student profile.",
      );
      setLoading(false);
    }
    return unsubscribe;
  }, [apogee]);
  useEffect(() => {
    if (!apogee) return;
    const rows = new Map<string, Row>();
    const publish = () => setRecords([...rows.values()]);
    const attendanceError = (error: unknown) => {
      console.error("Attendance Firestore error:", error);
      setAttendanceUnavailable(true);
    };
    let unsubApogee = () => {},
      unsubUid = () => {};
    try {
      unsubApogee = onSnapshot(
        query(
          collection(db, "attendance"),
          where("studentApogee", "==", apogee),
        ),
        (snapshot) => {
          snapshot
            .docChanges()
            .forEach((change) =>
              change.type === "removed"
                ? rows.delete(change.doc.id)
                : rows.set(change.doc.id, {
                    id: change.doc.id,
                    ...change.doc.data(),
                  }),
            );
          publish();
        },
        attendanceError,
      );
    } catch (error) {
      attendanceError(error);
    }
    const uid = String(value(student || undefined, "uid"));
    if (uid)
      try {
        unsubUid = onSnapshot(
          query(collection(db, "attendance"), where("studentUid", "==", uid)),
          (snapshot) => {
            snapshot
              .docChanges()
              .forEach((change) =>
                change.type === "removed"
                  ? rows.delete(change.doc.id)
                  : rows.set(change.doc.id, {
                      id: change.doc.id,
                      ...change.doc.data(),
                    }),
              );
            publish();
          },
          attendanceError,
        );
      } catch (error) {
        attendanceError(error);
      }
    return () => {
      unsubApogee();
      unsubUid();
    };
  }, [apogee, student?.uid]);
  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          (asDate(value(b, "date", "createdAt", "timestamp"))?.getTime() || 0) -
          (asDate(value(a, "date", "createdAt", "timestamp"))?.getTime() || 0),
      ),
    [records],
  );
  const present = records.filter(
      (r) => statusOf(r).toLowerCase() === "present",
    ).length,
    absent = records.filter(
      (r) => statusOf(r).toLowerCase() === "absent",
    ).length,
    late = records.filter((r) => statusOf(r).toLowerCase() === "late").length;
  const percentage = records.length
    ? Math.round((present / records.length) * 100)
    : Number(value(student || undefined, "attendance") || 0);
  const latest = sorted[0];
  const reportRows = sorted.map((r) => ({
    Student: `${value(student || undefined, "firstName")} ${value(student || undefined, "lastName")}`,
    Apogee: apogee,
    Department: value(student || undefined, "department"),
    Program: value(student || undefined, "program"),
    Level: value(student || undefined, "level"),
    Date: dateText(value(r, "date", "createdAt")),
    Course: value(r, "course", "courseName"),
    Room: value(r, "room", "classroom"),
    Entry: timeText(value(r, "entryTime")),
    Exit: timeText(value(r, "exitTime")),
    Duration: value(r, "duration"),
    Status: statusOf(r),
    "Attendance %": percentage,
  }));
  function excel() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(reportRows),
      "Attendance",
    );
    XLSX.writeFile(book, `attendance_${apogee}.xlsx`);
  }
  async function pdf() {
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(17);
    document.text(
      `${value(student || undefined, "firstName")} ${value(student || undefined, "lastName")} — ${apogee}`,
      14,
      15,
    );
    document.setFontSize(10);
    document.text(
      `${value(student || undefined, "department")} · ${value(student || undefined, "program")} · ${value(student || undefined, "level")} · Attendance ${percentage}%`,
      14,
      23,
    );
    const photo = String(value(student || undefined, "photo"));
    if (photo)
      try {
        const blob = await fetch(photo).then((r) => r.blob());
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        document.addImage(data, "JPEG", 245, 8, 28, 28);
      } catch (e) {
        console.warn("Student photo could not be added to PDF:", e);
      }
    autoTable(document, {
      startY: 32,
      head: [["Date", "Course", "Room", "Entry", "Exit", "Duration", "Status"]],
      body: sorted.map((r) => [
        dateText(value(r, "date", "createdAt")),
        value(r, "course", "courseName"),
        value(r, "room", "classroom"),
        timeText(value(r, "entryTime")),
        timeText(value(r, "exitTime")),
        value(r, "duration"),
        statusOf(r),
      ]),
    });
    document.save(`attendance_${apogee}.pdf`);
  }
  if (loading)
    return (
      <div
        className={`${panel} flex items-center justify-center gap-3 text-slate-400`}
      >
        <Loader2 className="animate-spin" />
        Loading student profile...
      </div>
    );
  if (missing)
    return (
      <div className={panel}>
        <button
          onClick={() => navigate("/professor/students")}
          className="mb-5 text-purple-300"
        >
          ← Back to Students
        </button>
        <p className="text-center text-slate-400">Student profile not found.</p>
      </div>
    );
  if (!student)
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300">
        {profileError || "Student profile not found."}
      </div>
    );
  const info = [
    ["Email", value(student, "email")],
    ["Phone", value(student, "phone")],
    ["Department", value(student, "department")],
    ["Program", value(student, "program")],
    ["Level", value(student, "level")],
    ["Academic year", value(student, "academicYear")],
    ["RFID UID", value(student, "rfidUID")],
    ["Student ID", value(student, "studentId")],
    [
      "University Registration Number",
      value(student, "universityRegistrationNumber"),
    ],
    ["Account status", value(student, "status")],
    ["Approval status", student.approved ? "Approved" : "Not approved"],
    ["Emergency contact", value(student, "emergencyContact")],
    ["Emergency phone", value(student, "emergencyPhone")],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <button
          onClick={() => navigate("/professor/students")}
          className="inline-flex items-center gap-2 text-sm text-purple-300"
        >
          <ArrowLeft size={17} />
          Back to Students
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={excel}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm"
          >
            <Download size={16} />
            Download Attendance Excel
          </button>
          <button
            onClick={() => void pdf()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm"
          >
            <Download size={16} />
            Download Attendance PDF
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm text-white"
          >
            <Printer size={16} />
            Print Profile
          </button>
        </div>
      </div>
      <section className={panel}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <StudentAvatar
            photo={String(value(student, "photo"))}
            firstName={String(value(student, "firstName"))}
            lastName={String(value(student, "lastName"))}
            size="xl"
          />
          <div>
            <p className="text-sm text-purple-400">Student Profile</p>
            <h1 className="text-3xl font-semibold text-white">
              {String(value(student, "firstName"))}{" "}
              {String(value(student, "lastName"))}
            </h1>
            <p className="text-slate-400">Apogee {apogee}</p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm ${student.present ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
            >
              {student.present ? "Present" : "Absent"}
            </span>
          </div>
          <div className="sm:ml-auto text-right">
            <p className="text-3xl font-semibold text-purple-300">
              {percentage}%
            </p>
            <p className="text-sm text-slate-500">attendance</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([label, item]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
            >
              <dt className="text-xs uppercase text-slate-500">
                {String(label)}
              </dt>
              <dd className="mt-1 break-words text-slate-100">
                {String(item || "—")}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total sessions", records.length],
          ["Present sessions", present],
          ["Absent sessions", absent],
          ["Late sessions", late],
          ["Attendance percentage", `${percentage}%`],
          [
            "Last attendance date",
            dateText(value(latest, "date", "createdAt")),
          ],
          ["Last entry time", timeText(value(latest, "entryTime"))],
          ["Last exit time", timeText(value(latest, "exitTime"))],
        ].map(([label, item]) => (
          <div key={String(label)} className={panel}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{item}</p>
          </div>
        ))}
      </section>
      <section className={`${panel} overflow-x-auto`}>
        <h2 className="mb-4 text-xl font-semibold text-white">
          Recent attendance
        </h2>
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              {[
                "Date",
                "Course",
                "Room",
                "Entry time",
                "Exit time",
                "Duration",
                "Status",
              ].map((h) => (
                <th className="px-3 py-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-3 py-3">
                  {dateText(value(r, "date", "createdAt"))}
                </td>
                <td className="px-3 py-3">
                  {String(value(r, "course", "courseName") || "—")}
                </td>
                <td className="px-3 py-3">
                  {String(value(r, "room", "classroom") || "—")}
                </td>
                <td className="px-3 py-3">{timeText(value(r, "entryTime"))}</td>
                <td className="px-3 py-3">{timeText(value(r, "exitTime"))}</td>
                <td className="px-3 py-3">
                  {String(value(r, "duration") || "—")}
                </td>
                <td className="px-3 py-3">{statusOf(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && (
          <p className="py-8 text-center text-sm text-slate-500">
            No attendance records available
          </p>
        )}
      </section>
    </div>
  );
}
