import { motion } from 'framer-motion';
import type { RoomSeat, StudentProfile } from '../data/mock';

interface RoomMapProps {
  seats: RoomSeat[];
  students: StudentProfile[];
  onSelect: (student: StudentProfile) => void;
  tone?: 'dark' | 'light';
}

const statusStyles: Record<RoomSeat['status'], string> = {
  occupied: 'bg-emerald-500/90 border-emerald-400',
  empty: 'bg-slate-700/80 border-slate-600',
  absent: 'bg-rose-500/90 border-rose-400',
  reserved: 'bg-sky-500/90 border-sky-400',
};

export function RoomMap({ seats, students, onSelect, tone = 'dark' }: RoomMapProps) {
  const shell = tone === 'dark'
    ? 'border-slate-800 bg-slate-900/80 shadow-slate-950/30'
    : 'border-slate-200 bg-white/90 shadow-slate-200/70';
  const muted = tone === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const strong = tone === 'dark' ? 'text-white' : 'text-slate-900';

  return (
    <div className={`rounded-3xl border p-6 shadow-lg ${shell}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className={`text-sm ${muted}`}>Live room map</p>
          <h3 className={`text-xl font-semibold ${strong}`}>Amphi A seat overview</h3>
        </div>
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">Seat occupancy</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-7">
        {seats.map((seat) => {
          const student = seat.studentId ? students.find((item) => item.id === seat.studentId) : undefined;
          return (
            <motion.button
              key={seat.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => student && onSelect(student)}
              className={`group flex h-20 flex-col items-center justify-center rounded-3xl border px-2 text-center text-xs font-medium transition ${statusStyles[seat.status]} ${student ? 'cursor-pointer' : 'cursor-default'} ${seat.status === 'empty' ? 'opacity-80' : ''}`}
            >
              <span className="text-white">{seat.id.replace('seat-', '')}</span>
              <span className="mt-1 text-[10px] text-slate-200">
                {student ? `${student.firstName}` : 'Empty'}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
