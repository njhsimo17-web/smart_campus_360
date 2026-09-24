import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Search,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../../firebase";
import StudentAvatar from "../../components/StudentAvatar";

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  apogee: string;
  department: string;
  program: string;
  level: string;
  photo: string;
  email: string;
  phone: string;
  attendance: number;
  present: boolean;
  rfidUID: string;
  status: string;
}
type ExportKind = "xlsx" | "csv" | "pdf";
const panel =
  "rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20";
const control =
  "rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500";
const exportHeaders = [
  "First Name",
  "Last Name",
  "Apogee",
  "Department",
  "Program",
  "Level",
  "Email",
  "Phone",
  "Attendance",
  "Present Status",
  "RFID UID",
];

export function normalizeDepartment(department: string): string {
  if (!department) return "Unknown";
  const value = department.trim().toLowerCase();
  const map: Record<string, string> = {
    "electronique embarquee": "Électronique Embarquée",
    "électronique embarquée": "Électronique Embarquée",
    "energies renouvelables": "Énergies Renouvelables",
    "énergies renouvelables": "Énergies Renouvelables",
    "systemes de telecommunication": "Systèmes de Télécommunication",
    "systèmes de télécommunication": "Systèmes de Télécommunication",
    physique: "Physique",
    chimie: "Chimie",
    informatique: "Informatique",
    mathematiques: "Mathématiques",
    mathématiques: "Mathématiques",
    electronique: "Électronique",
    électronique: "Électronique",
    energie: "Énergie",
    énergie: "Énergie",
  };
  return map[value] || value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeProgram(program: string): string {
  if (!program) return "Programme non renseigné";
  const value=program.trim().toLowerCase();
  const map:Record<string,string>={"electronique embarquee":"Électronique Embarquée","électronique embarquée":"Électronique Embarquée","energies renouvelables":"Énergies Renouvelables","énergies renouvelables":"Énergies Renouvelables","systemes de telecommunication":"Systèmes de Télécommunication","systèmes de télécommunication":"Systèmes de Télécommunication"};
  return map[value]||value.charAt(0).toUpperCase()+value.slice(1);
}

function groupStudents(rows: StudentRow[], key: "department" | "program" | "level") {
  return rows.reduce<Record<string, StudentRow[]>>((groups, student) => {
    const name = key === "department" ? normalizeDepartment(student.department) : key === "program" ? normalizeProgram(student.program) : student.level || "Unspecified";
    (groups[name] ??= []).push(student);
    return groups;
  }, {});
}
function initials(student: StudentRow) {
  return (
    `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase() ||
    "—"
  );
}
void initials;
function safeName(value: string) {
  return (value || "all")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}
function exportData(student: StudentRow) {
  return {
    "First Name": student.firstName,
    "Last Name": student.lastName,
    Apogee: student.apogee,
    Department: normalizeDepartment(student.department),
    Program: normalizeProgram(student.program),
    Level: student.level,
    Email: student.email,
    Phone: student.phone,
    Attendance: student.attendance,
    "Present Status": student.present ? "Present" : "Absent",
    "RFID UID": student.rfidUID,
  };
}

function downloadStudents(
  rows: StudentRow[],
  kind: ExportKind,
  department: string,
  program: string,
  level: string,
) {
  const date = new Date().toISOString().slice(0, 10);
  const base = `students_${safeName(department)}_${safeName(program)}_${safeName(level)}_${date}`;
  const data = rows.map(exportData);
  if (kind === "xlsx") {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(data),
      "Students",
    );
    XLSX.writeFile(book, `${base}.xlsx`);
  }
  if (kind === "csv") {
    const csv =
      "\uFEFF" + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(data));
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${base}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  if (kind === "pdf") {
    const pdf = new jsPDF({ orientation: "landscape" });
    pdf.text(`${department}${program ? ` — ${program}` : ""}${level ? ` — ${level}` : ""}`, 14, 15);
    autoTable(pdf, {
      startY: 20,
      head: [exportHeaders],
      body: data.map((row) =>
        exportHeaders.map((h) => String(row[h as keyof typeof row] ?? "")),
      ),
      styles: { fontSize: 7 },
    });
    pdf.save(`${base}.pdf`);
  }
  const toast = (
    window as Window & { showAppToast?: (message: string) => void }
  ).showAppToast;
  if (toast) toast("Student list exported successfully.");
  else window.alert("Student list exported successfully.");
}

export function ExportMenu({
  students,
  department,
  program = "",
  level = "",
}: {
  students: StudentRow[];
  department: string;
  program?: string;
  level?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 hover:border-purple-500"
      >
        <Download size={16} />
        Download List
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-36 rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-xl">
          {(["xlsx", "csv", "pdf"] as ExportKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadStudents(students, k, department, program, level);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
            >
              {k === "xlsx" ? "Excel" : k.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentTable({ students }: { students: StudentRow[] }) {
  const navigate=useNavigate();
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="bg-slate-950/70 text-xs uppercase text-slate-500">
          <tr>
            {[
              "Photo",
              "First Name",
              "Last Name",
              "Apogee",
              "Department",
              "Program",
              "Level",
              "Attendance %",
              "Current Status",
              "RFID Status",
              "Actions",
            ].map((h) => (
              <th key={h} className="px-3 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-t border-slate-800 text-slate-300">
              <td className="px-3 py-3">
                <StudentAvatar photo={s.photo} firstName={s.firstName} lastName={s.lastName} size="sm" />
              </td>
              <td className="px-3 py-3 text-white">{s.firstName}</td>
              <td className="px-3 py-3 text-white">{s.lastName}</td>
              <td className="px-3 py-3">{s.apogee}</td>
              <td className="px-3 py-3">{s.department}</td>
              <td className="px-3 py-3">{s.program}</td>
              <td className="px-3 py-3">{s.level}</td>
              <td className="px-3 py-3 font-semibold text-purple-300">
                {s.attendance}%
              </td>
              <td className="px-3 py-3">
                <span
                  className={`rounded-full px-2 py-1 ${s.present ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
                >
                  {s.present ? "Present" : "Absent"}
                </span>
              </td>
              <td className="px-3 py-3">
                <span
                  className={`rounded-full px-2 py-1 ${s.rfidUID ? "bg-cyan-500/15 text-cyan-300" : "bg-slate-800 text-slate-400"}`}
                >
                  {s.rfidUID ? "Assigned" : "Not assigned"}
                </span>
              </td>
              <td className="px-3 py-3"><button type="button" onClick={()=>navigate(`/professor/students/${encodeURIComponent(s.apogee)}`)} className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-200 hover:bg-purple-500/20"><Eye size={15}/>View Profile</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!students.length && (
        <p className="p-8 text-center text-sm text-slate-500">
          No active students match these filters.
        </p>
      )}
    </div>
  );
}

export function LevelSection({
  level,
  students,
}: {
  level: string;
  students: StudentRow[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 text-left font-medium text-white"
        >
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}{" "}
          {level}{" "}
          <span className="text-sm font-normal text-slate-500">
            {students.length} students
          </span>
        </button>
        <ExportMenu
          students={students}
          department={students[0]?.department || "all"}
          program={students[0]?.program || "all"}
          level={level}
        />
      </div>
      {open && (
        <div className="px-4 pb-4">
          <StudentTable students={students} />
        </div>
      )}
    </section>
  );
}

export function ProgramSection({program,students}:{program:string;students:StudentRow[]}){
  const [open,setOpen]=useState(false);const levels=groupStudents(students,"level");
  return <section className="rounded-2xl border border-slate-800 bg-slate-950/40"><div className="flex flex-wrap items-center gap-3 p-4"><div className="flex-1"><h3 className="font-medium text-white">{program}</h3><p className="mt-1 text-sm text-slate-500">{students.length} students · {Object.keys(levels).length} available levels</p></div><button type="button" onClick={()=>setOpen(!open)} className="rounded-xl bg-purple-600 px-3 py-2 text-sm text-white">{open?'Hide Students':'View Students'}</button><ExportMenu students={students} department={students[0]?.department||'all'} program={program}/></div>{open&&<div className="space-y-3 px-4 pb-4">{Object.entries(levels).sort(([a],[b])=>a.localeCompare(b)).map(([name,list])=><LevelSection key={name} level={name} students={list}/>)}</div>}</section>;
}

export function DepartmentCard({
  department,
  students,
}: {
  department: string;
  students: StudentRow[];
}) {
  const [open, setOpen] = useState(false);
  const present = students.filter((s) => s.present).length;
  const average = students.length
    ? Math.round(
        students.reduce((n, s) => n + s.attendance, 0) / students.length,
      )
    : 0;
  const programs = groupStudents(students, "program");
  return (
    <article className={panel}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-300">
          <Users />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-white">{department}</h2>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-400">
            <span>{students.length} students</span>
            <span>{Object.keys(programs).length} programs</span>
            <span>{present} present</span>
            <span>{average}% average attendance</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-xl bg-purple-600 px-3 py-2 text-sm text-white"
        >
          {open ? "Hide Students" : "View Students"}
        </button>
        <ExportMenu students={students} department={department} />
      </div>
      {open && (
        <div className="mt-5 space-y-3 border-t border-slate-800 pt-5">
          {Object.entries(programs)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, list]) => (
              <ProgramSection key={name} program={name} students={list} />
            ))}
        </div>
      )}
    </article>
  );
}

export default function ProfessorStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [department, setDepartment] = useState(""),
    [program, setProgram] = useState(""),
    [level, setLevel] = useState(""),
    [presence, setPresence] = useState(""),
    [rfid, setRfid] = useState("");
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "students"), where("status", "==", "active")),
        (snapshot) => {
          setStudents(
            snapshot.docs.map((d) => {
              const x = d.data();
              const rawDepartment=String(x.department||"");
              const legacyProgram=normalizeProgram(rawDepartment);
              const isLegacyPhysicsProgram=["Électronique Embarquée","Énergies Renouvelables","Systèmes de Télécommunication"].includes(legacyProgram);
              return {
                id: d.id,
                firstName: String(x.firstName || ""),
                lastName: String(x.lastName || ""),
                apogee: String(x.apogee || d.id),
                department: isLegacyPhysicsProgram ? "Physique" : normalizeDepartment(rawDepartment),
                program: normalizeProgram(String(x.program || (isLegacyPhysicsProgram ? rawDepartment : ""))),
                level: String(x.level || "Unspecified"),
                photo: String(x.photo || ""),
                email: String(x.email || ""),
                phone: String(x.phone || ""),
                attendance: Number(x.attendance || 0),
                present: x.present === true,
                rfidUID: String(x.rfidUID || ""),
                status: String(x.status || ""),
              };
            }),
          );
          setLoading(false);
          setError("");
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    [],
  );
  const departments = useMemo(
    () => [...new Set(students.map((s) => normalizeDepartment(s.department)))].sort(),
    [students],
  );
  const levels = useMemo(
    () => [...new Set(students.map((s) => s.level))].sort(),
    [students],
  );
  const programs = useMemo(
    () => [...new Set([...(department==='Physique'?['Électronique Embarquée','Énergies Renouvelables','Systèmes de Télécommunication']:[]),...students.filter((s) => !department || s.department === department).map((s) => normalizeProgram(s.program))])].sort(),
    [students, department],
  );
  const filtered = students.filter(
    (s) =>
      (!search ||
        `${s.firstName} ${s.lastName} ${s.apogee}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!department || normalizeDepartment(s.department) === department) &&
      (!program || normalizeProgram(s.program) === program) &&
      (!level || s.level === level) &&
      (!presence || (presence === "present") === s.present) &&
      (!rfid || (rfid === "assigned") === Boolean(s.rfidUID)),
  );
  const grouped = groupStudents(filtered, "department");
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-purple-400">Professor Portal</p>
        <h1 className="text-3xl font-semibold text-white">Students</h1>
        <p className="mt-1 text-sm text-slate-400">
          Active students organized by department and study level.
        </p>
      </div>
      <div className={`${panel} grid gap-3 sm:grid-cols-2 xl:grid-cols-6`}>
        <div className="relative">
          <Search
            className="absolute left-3 top-2.5 text-slate-500"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or apogee"
            className={`${control} w-full pl-10`}
          />
        </div>
        {[
          [department, (value:string)=>{setDepartment(value);setProgram("")}, "All Departments", departments],
          [program, setProgram, "All Programs", programs],
          [level, setLevel, "All Levels", levels],
        ].map(([value, setter, label, options]) => (
          <select
            key={String(label)}
            value={value as string}
            onChange={(e) => (setter as (v: string) => void)(e.target.value)}
            className={control}
          >
            <option value="">{String(label)}</option>
            {(options as string[]).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        ))}
        <select
          value={presence}
          onChange={(e) => setPresence(e.target.value)}
          className={control}
        >
          <option value="">Present / absent</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
        </select>
        <select
          value={rfid}
          onChange={(e) => setRfid(e.target.value)}
          className={control}
        >
          <option value="">RFID status</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Not assigned</option>
        </select>
      </div>
      {loading ? (
        <div className={`${panel} text-center text-slate-400`}>
          Loading students...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-300">
          Unable to load students: {error}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, list]) => (
              <DepartmentCard
                key={name}
                department={name}
                students={list || []}
              />
            ))}
          {!filtered.length && (
            <div className={`${panel} text-center text-slate-500`}>
              No active students match these filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
