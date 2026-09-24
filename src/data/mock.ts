export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  apogee: string;
  rfid: string;
  email: string;
  department: string;
  studentClass: string;
  year: string;
  phone: string;
  attendance: number;
  status: 'Present' | 'Absent' | 'Late' | 'Reserved';
  room: string;
  entryTime: string;
  exitTime: string;
  registeredAt: string;
  photo: string;
  recentActivity: string[];
}

export interface AttendanceRecord {
  id: string;
  photo: string;
  name: string;
  apogee: string;
  rfid: string;
  room: string;
  teacher: string;
  entryTime: string;
  exitTime: string;
  duration: string;
  status: 'Present' | 'Absent' | 'Late';
  attendance: string;
}

export interface ClassroomInfo {
  id: string;
  name: string;
  teacher: string;
  course: string;
  schedule: string;
  capacity: number;
  currentStudents: number;
  occupancy: number;
  temperature: number;
  humidity: number;
  irEntry: string;
  irExit: string;
  rfidStatus: string;
  activity: string;
  image: string;
}

export interface Esp32Device {
  id: string;
  name: string;
  ip: string;
  mac: string;
  wifi: number;
  firmware: string;
  temperature: number;
  cpu: number;
  ram: number;
  uptime: string;
  lastSeen: string;
  status: 'Online' | 'Offline' | 'Warning';
}

export interface SensorStatus {
  id: string;
  name: string;
  type: string;
  status: 'Online' | 'Offline' | 'Error' | 'Testing';
  lastUpdate: string;
  description: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  type: 'success' | 'warning' | 'error' | 'info';
  description: string;
  time: string;
}

export interface RFIDRecord {
  id: string;
  uid: string;
  student: string;
  assignedDate: string;
  status: 'Active' | 'Unassigned' | 'Blocked';
  lastScan: string;
  scans: number;
}

export interface LiveEvent {
  id: string;
  time: string;
  name: string;
  event: 'Entry' | 'Exit' | 'Alert';
  room: string;
  color: string;
}

export interface RoomSeat {
  id: string;
  row: number;
  column: number;
  studentId?: string;
  status: 'occupied' | 'empty' | 'absent' | 'reserved';
}

export const dashboardStats = [
  {
    key: 'present',
    label: 'Students present',
    value: '48',
    trend: '+8%',
    evolution: 'vs last hour',
    color: 'from-cyan-500 to-sky-600',
    tooltip: 'Live room occupancy from RFID scans.',
  },
  {
    key: 'capacity',
    label: 'Room capacity',
    value: '80',
    trend: '+2%',
    evolution: 'available seats',
    color: 'from-fuchsia-500 to-purple-600',
    tooltip: 'Configured maximum number of seats in the room.',
  },
  {
    key: 'occupancy',
    label: 'Occupancy %',
    value: '60%',
    trend: '+4%',
    evolution: 'today',
    color: 'from-amber-500 to-orange-600',
    tooltip: 'Current percentage of filled seats in the room.',
  },
  {
    key: 'entries',
    label: 'Entries today',
    value: '132',
    trend: '+12%',
    evolution: 'compared to yesterday',
    color: 'from-emerald-500 to-green-600',
    tooltip: 'Number of entry scans recorded today.',
  },
  {
    key: 'exits',
    label: 'Exits today',
    value: '118',
    trend: '+6%',
    evolution: 'compared to yesterday',
    color: 'from-indigo-500 to-blue-600',
    tooltip: 'Number of exit scans recorded today.',
  },
  {
    key: 'registered',
    label: 'Registered students',
    value: '284',
    trend: '+1.2%',
    evolution: 'new this week',
    color: 'from-rose-500 to-pink-600',
    tooltip: 'Total number of enrolled students in the campus system.',
  },
  {
    key: 'devices',
    label: 'Connected ESP32',
    value: '4',
    trend: '+1',
    evolution: 'online devices',
    color: 'from-violet-500 to-violet-600',
    tooltip: 'ESP32 devices currently connected to the platform.',
  },
  {
    key: 'alerts',
    label: 'Active alerts',
    value: '3',
    trend: '-25%',
    evolution: 'resolved today',
    color: 'from-red-500 to-rose-600',
    tooltip: 'Open platform alerts requiring attention.',
  },
];

export const students: StudentProfile[] = [
  {
    id: '1',
    firstName: 'Mohamed',
    lastName: 'Najeh',
    apogee: 'P230145',
    rfid: '01020304',
    email: 'mohamed.najeh@campus.edu',
    department: 'Computer Engineering',
    studentClass: 'CSE-4A',
    year: '2026',
    phone: '+216 98 765 432',
    attendance: 92,
    status: 'Present',
    room: 'Amphi A',
    entryTime: '08:15',
    exitTime: '10:00',
    registeredAt: '2024-09-02',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
    recentActivity: ['Entry scanned in Amphi A', 'Viewed classroom schedule', 'Updated profile settings'],
  },
  {
    id: '2',
    firstName: 'Sara',
    lastName: 'El Hadi',
    apogee: 'P230156',
    rfid: 'A1B2C3D4',
    email: 'sara.elhadi@campus.edu',
    department: 'Information Systems',
    studentClass: 'IS-3B',
    year: '2026',
    phone: '+216 97 654 321',
    attendance: 88,
    status: 'Late',
    room: 'Room B',
    entryTime: '08:32',
    exitTime: '10:00',
    registeredAt: '2024-09-10',
    photo: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=256&q=80',
    recentActivity: ['Late scan recorded', 'Missed first lecture', 'Exported attendance report'],
  },
  {
    id: '3',
    firstName: 'Malika',
    lastName: 'Cherif',
    apogee: 'P230162',
    rfid: 'F1E2D3C4',
    email: 'malika.cherif@campus.edu',
    department: 'Mechanical Engineering',
    studentClass: 'ME-2C',
    year: '2025',
    phone: '+216 95 321 678',
    attendance: 75,
    status: 'Absent',
    room: 'Amphi A',
    entryTime: '-',
    exitTime: '-',
    registeredAt: '2024-09-08',
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&q=80',
    recentActivity: ['Absent today', 'Followed up with professor', 'Reviewed course material'],
  },
];

export const attendanceRecords: AttendanceRecord[] = [
  {
    id: '1',
    photo: students[0].photo,
    name: `${students[0].firstName} ${students[0].lastName}`,
    apogee: students[0].apogee,
    rfid: students[0].rfid,
    room: students[0].room,
    teacher: 'Pr. Amine',
    entryTime: '08:15',
    exitTime: '10:00',
    duration: '1h 45m',
    status: 'Present',
    attendance: '92%',
  },
  {
    id: '2',
    photo: students[1].photo,
    name: `${students[1].firstName} ${students[1].lastName}`,
    apogee: students[1].apogee,
    rfid: students[1].rfid,
    room: students[1].room,
    teacher: 'Pr. Salma',
    entryTime: '08:32',
    exitTime: '10:00',
    duration: '1h 28m',
    status: 'Late',
    attendance: '88%',
  },
  {
    id: '3',
    photo: students[2].photo,
    name: `${students[2].firstName} ${students[2].lastName}`,
    apogee: students[2].apogee,
    rfid: students[2].rfid,
    room: students[2].room,
    teacher: 'Pr. Leila',
    entryTime: '-',
    exitTime: '-',
    duration: '-',
    status: 'Absent',
    attendance: '75%',
  },
];

export const classrooms: ClassroomInfo[] = [
  {
    id: 'amphi-a',
    name: 'Amphi A',
    teacher: 'Pr. Amine',
    course: 'IoT Systems',
    schedule: '08:00 - 10:00 / Mon-Fri',
    capacity: 80,
    currentStudents: 48,
    occupancy: 60,
    temperature: 24,
    humidity: 48,
    irEntry: 'Online',
    irExit: 'Online',
    rfidStatus: 'Stable',
    activity: 'Lecture in progress',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'room-b',
    name: 'Room B',
    teacher: 'Pr. Salma',
    course: 'Software Design',
    schedule: '10:30 - 12:30 / Mon-Wed',
    capacity: 40,
    currentStudents: 22,
    occupancy: 55,
    temperature: 23,
    humidity: 46,
    irEntry: 'Online',
    irExit: 'Online',
    rfidStatus: 'Stable',
    activity: 'Project review',
    image: 'https://images.unsplash.com/photo-1485841890310-6a055c88698a?auto=format&fit=crop&w=1000&q=80',
  },
];

export const esp32Devices: Esp32Device[] = [
  {
    id: 'esp-01',
    name: 'ESP32 Amphi A',
    ip: '192.168.2.21',
    mac: 'AA:BB:CC:DD:EE:01',
    wifi: 91,
    firmware: 'v1.0.4',
    temperature: 38,
    cpu: 22,
    ram: 58,
    uptime: '3h 12m',
    lastSeen: '1 min ago',
    status: 'Online',
  },
  {
    id: 'esp-02',
    name: 'ESP32 Room B',
    ip: '192.168.2.22',
    mac: 'AA:BB:CC:DD:EE:02',
    wifi: 78,
    firmware: 'v1.0.3',
    temperature: 35,
    cpu: 27,
    ram: 64,
    uptime: '5h 40m',
    lastSeen: '2 min ago',
    status: 'Online',
  },
];

export const sensors: SensorStatus[] = [
  { id: 'sensor-1', name: 'RFID Reader', type: 'RFID', status: 'Online', lastUpdate: '12 sec ago', description: 'Reads student tags at the entrance.' },
  { id: 'sensor-2', name: 'IR Sensor Entry', type: 'IR Entry', status: 'Online', lastUpdate: '8 sec ago', description: 'Monitors incoming students.' },
  { id: 'sensor-3', name: 'IR Sensor Exit', type: 'IR Exit', status: 'Online', lastUpdate: '10 sec ago', description: 'Monitors outgoing students.' },
  { id: 'sensor-4', name: 'OLED Display', type: 'Display', status: 'Online', lastUpdate: '3 sec ago', description: 'Shows room status and alerts.' },
  { id: 'sensor-5', name: 'Green LED', type: 'Indicator', status: 'Online', lastUpdate: '3 sec ago', description: 'Visual status indicator.' },
  { id: 'sensor-6', name: 'Red LED', type: 'Indicator', status: 'Error', lastUpdate: '5 sec ago', description: 'Error indicator for alerts.' },
  { id: 'sensor-7', name: 'Buzzer', type: 'Alert', status: 'Testing', lastUpdate: '15 sec ago', description: 'Used for alarm notifications.' },
];

export const notifications: NotificationItem[] = [
  { id: 'n1', title: 'Unknown RFID detected', type: 'warning', description: 'Scan at Amphi A with unregistered tag.', time: '2 min ago' },
  { id: 'n2', title: 'Room Almost Full', type: 'info', description: 'Occupancy reached 92% in Room B.', time: '12 min ago' },
  { id: 'n3', title: 'ESP32 Offline', type: 'error', description: 'Device ESP32 Room C lost connection.', time: '45 min ago' },
  { id: 'n4', title: 'Attendance report exported', type: 'success', description: 'Weekly attendance report downloaded.', time: '1h ago' },
];

export const rfidRecords: RFIDRecord[] = [
  { id: 'r1', uid: '01020304', student: 'Mohamed Najeh', assignedDate: '2024-09-01', status: 'Active', lastScan: '08:15', scans: 74 },
  { id: 'r2', uid: 'A1B2C3D4', student: 'Sara El Hadi', assignedDate: '2024-09-10', status: 'Active', lastScan: '08:32', scans: 63 },
  { id: 'r3', uid: 'FF9900AA', student: 'Unknown', assignedDate: '-', status: 'Unassigned', lastScan: '08:41', scans: 9 },
];

export const liveEvents: LiveEvent[] = [
  { id: 'e1', time: '08:15', name: 'Mohamed Najeh', event: 'Entry', room: 'Amphi A', color: 'bg-emerald-400' },
  { id: 'e2', time: '08:20', name: 'Malika Cherif', event: 'Exit', room: 'Amphi A', color: 'bg-rose-400' },
  { id: 'e3', time: '08:30', name: 'Unknown RFID', event: 'Alert', room: 'Amphi A', color: 'bg-amber-400' },
];

export const roomSeats: RoomSeat[] = Array.from({ length: 28 }, (_, index) => {
  const row = Math.floor(index / 7) + 1;
  const column = (index % 7) + 1;
  const occupant = [
    { id: '1', status: 'occupied' as const, studentId: '1' },
    { id: '2', status: 'occupied' as const, studentId: '2' },
    { id: '3', status: 'absent' as const, studentId: '3' },
  ][index % 7];

  return {
    id: `seat-${row}-${column}`,
    row,
    column,
    studentId: occupant?.studentId,
    status: occupant?.status ?? 'empty',
  };
});

export const aiInsights = {
  peakHours: '09:00 - 10:00',
  mostOccupiedRoom: 'Amphi A',
  predictedOccupancy: '78%',
  averageAttendance: '85%',
  lowAttendanceStudents: 6,
  activeClassrooms: 12,
  recommendations: [
    'Optimize timetable to reduce peak load.',
    'Add one more IR sensor to Room B.',
    'Notify students with attendance below 75%.',
  ],
};
