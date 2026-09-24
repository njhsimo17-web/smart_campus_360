import { Timestamp } from 'firebase/firestore';

export type UserRole = 'student' | 'professor' | 'admin';

export type UserStatus = 'pending' | 'Pending Approval' | 'approved' | 'Approved' | 'rejected' | 'Rejected' | 'active' | 'inactive' | 'Active' | 'Inactive';

export interface BaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  approved?: boolean;
  approvedAt?: Timestamp | null;
  photo?: string;
  phone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Student extends BaseUser {
  role: 'student';
  apogee: string;
  department: string;
  program: string;
  level: string;
  academicYear: string;
  studentId?: string;
  universityRegNumber?: string;
  universityRegistrationNumber?: string;
  rfidUID?: string;
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: Timestamp;
  nationality?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  attendance?: number;
  present?: boolean;
  room?: string;
  entryTime?: string;
  exitTime?: string;
}

export interface Professor extends BaseUser {
  role: 'professor';
  department: string;
  employeeId?: string;
  subjects?: string[];
  assignedClassrooms?: string[];
}

export interface Admin extends BaseUser {
  role: 'admin';
  permissions?: string[];
}

export type User = Student | Professor | Admin;

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  apogee: string;
  rfidUID: string;
  room: string;
  teacher: string;
  entryTime: Timestamp;
  exitTime?: Timestamp;
  duration?: string;
  status: 'Present' | 'Absent' | 'Late';
  date: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  role: UserRole;
  title: string;
  description: string;
  type: 'success' | 'warning' | 'error' | 'info';
  read: boolean;
  createdAt: Timestamp;
}

export interface Classroom {
  id: string;
  name: string;
  teacher: string;
  course: string;
  schedule: string;
  capacity: number;
  currentStudents: number;
  occupancy: number;
  temperature?: number;
  humidity?: number;
}

export interface RFIDCard {
  id: string;
  uid: string;
  studentId?: string;
  studentName?: string;
  assignedDate?: Timestamp;
  status: 'Active' | 'Unassigned' | 'Blocked';
  lastScan?: Timestamp;
  scans: number;
}

export interface SystemLog {
  id: string;
  action: string;
  userId?: string;
  role?: UserRole;
  details: string;
  timestamp: Timestamp;
}

export interface DeviceAction {
  id: string;
  deviceId: string;
  action: string;
  timestamp: Timestamp;
  status: 'pending' | 'completed' | 'failed';
}
