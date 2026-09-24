import { motion } from 'framer-motion';
import { Activity, ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  trend: string;
  evolution: string;
  color: string;
  tooltip: string;
  icon?: React.ReactNode;
  tone?: 'dark' | 'light';
}

export function StatCard({
  label,
  value,
  trend,
  evolution,
  color,
  tooltip,
  icon = <Activity size={18} />,
  tone = 'dark',
}: StatCardProps) {
  const shell = tone === 'dark'
    ? 'border-slate-800 bg-slate-900/90 shadow-slate-950/20'
    : 'border-slate-200 bg-white/90 shadow-slate-200/70';
  const muted = tone === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const strong = tone === 'dark' ? 'text-white' : 'text-slate-900';
  const sub = tone === 'dark' ? 'text-slate-300' : 'text-slate-600';
  const chip = tone === 'dark' ? 'bg-slate-950/80 text-slate-200' : 'bg-slate-100 text-slate-700';

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.25 }}
      className={`group overflow-hidden rounded-3xl border p-5 shadow-xl ${shell}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm ${muted}`}>{label}</p>
          <p className={`mt-4 text-3xl font-semibold ${strong}`}>{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'} shadow-inner`}>
          {icon}
        </div>
      </div>

      <div className={`mt-5 flex items-center justify-between gap-3 border-t pt-4 text-sm ${muted}`}>
        <div className={`rounded-full px-3 py-1 shadow-sm ${chip}`}>{trend}</div>
        <div className="text-right leading-5">
          <p className={sub}>{evolution}</p>
          <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-white ${color}`}>
            <ArrowUpRight size={12} />
            {tooltip}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
