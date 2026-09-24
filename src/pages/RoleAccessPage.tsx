import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

interface RoleAccessPageProps {
  title: string;
  description: string;
  accent: 'cyan' | 'purple' | 'rose';
  highlights: string[];
}

export default function RoleAccessPage({ title, description, accent, highlights }: RoleAccessPageProps) {
  const accentClasses = {
    cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
  }[accent];

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40"
      >
        <div className={`mb-6 inline-flex rounded-2xl border p-3 ${accentClasses}`}>
          <ShieldCheck size={24} />
        </div>
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {highlights.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
