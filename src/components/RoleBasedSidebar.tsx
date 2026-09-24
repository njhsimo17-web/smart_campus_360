import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import type { UserRole } from '../types';
import SmartCampusLogo from './SmartCampusLogo';

interface NavItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  // Student navigation
  { label: 'Dashboard', path: '/student/dashboard', roles: ['student'] },
  { label: 'Profile', path: '/student/profile', roles: ['student'] },
  { label: 'Attendance', path: '/student/attendance', roles: ['student'] },
  { label: 'Notifications', path: '/student/notifications', roles: ['student'] },
  { label: 'Settings', path: '/student/settings', roles: ['student'] },
  
  // Professor navigation
  { label: 'Dashboard', path: '/professor/dashboard', roles: ['professor'] },
  { label: 'My Classes', path: '/professor/classes', roles: ['professor'] },
  { label: 'Attendance', path: '/professor/attendance', roles: ['professor'] },
  { label: 'Students', path: '/professor/students', roles: ['professor'] },
  { label: 'Reports', path: '/professor/reports', roles: ['professor'] },
  { label: 'Statistics', path: '/professor/statistics', roles: ['professor'] },
  { label: 'Notifications', path: '/professor/notifications', roles: ['professor'] },
  { label: 'Profile', path: '/professor/profile', roles: ['professor'] },
  
  // Admin navigation
  { label: 'Dashboard', path: '/admin/dashboard', roles: ['admin'] },
  { label: 'Pending Registrations', path: '/admin/pending-registrations', roles: ['admin'] },
  { label: 'RFID Management', path: '/admin/rfid-management', roles: ['admin'] },
  { label: 'Students', path: '/admin/students', roles: ['admin'] },
  { label: 'Professors', path: '/admin/professors', roles: ['admin'] },
  { label: 'Classrooms', path: '/admin/classrooms', roles: ['admin'] },
  { label: 'Attendance', path: '/admin/attendance', roles: ['admin'] },
  { label: 'ESP32', path: '/admin/esp32', roles: ['admin'] },
  { label: 'Sensors', path: '/admin/sensors', roles: ['admin'] },
  { label: 'Notifications', path: '/admin/notifications', roles: ['admin'] },
  { label: 'Reports', path: '/admin/reports', roles: ['admin'] },
  { label: 'Statistics', path: '/admin/statistics', roles: ['admin'] },
  { label: 'Settings', path: '/admin/settings', roles: ['admin'] },
];

export default function RoleBasedSidebar() {
  const { userRole, userData, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole !== 'admin') return;
    const q = query(collection(db, 'students'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    }, (err) => {
      console.error('Error fetching pending registrations count:', err);
    });

    return () => unsubscribe();
  }, [userRole]);

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole as UserRole);
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleColor = () => {
    switch (userRole) {
      case 'student':
        return 'text-cyan-400';
      case 'professor':
        return 'text-purple-400';
      case 'admin':
        return 'text-rose-400';
      default:
        return 'text-slate-400';
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'student':
        return 'Student Portal';
      case 'professor':
        return 'Professor Portal';
      case 'admin':
        return 'Admin Portal';
      default:
        return 'Smart Campus';
    }
  };

  return (
    <aside className="w-64 min-h-screen overflow-x-hidden border-r border-slate-800 bg-slate-900/90 p-4 flex flex-col">
      <div className="mb-6 flex min-w-0 items-center gap-3 px-3 py-4">
        <SmartCampusLogo size={userRole === 'professor' ? 'lg' : 'md'} showText={false} />
        <div className="min-w-0"><h1 className="truncate text-base font-semibold text-white">Smart Campus</h1>
        <h2 className={`truncate text-sm ${getRoleColor()}`}>{getRoleLabel()}</h2>
        <p className="truncate text-xs text-slate-400">{userData?.firstName} {userData?.lastName}</p></div>
      </div>

      <nav className="space-y-1 flex-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span>{item.label}</span>
              {item.path === '/admin/pending-registrations' && pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  {pendingCount}
                </span>
              )}
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="block w-full rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition text-left"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
