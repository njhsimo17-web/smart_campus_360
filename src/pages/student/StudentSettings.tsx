import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings2, ShieldCheck } from 'lucide-react';

export default function StudentSettings() {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-400">
            <Settings2 size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="text-sm text-slate-400">Manage your preferences and security options.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Push notifications</h2>
              <p className="mt-1 text-sm text-slate-400">Receive attendance and approval alerts in real time.</p>
            </div>
            <button onClick={() => setEnabled((value) => !value)} className={`rounded-full px-4 py-2 text-sm font-medium ${enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-white">Security</h2>
              <p className="mt-1 text-sm text-slate-400">Your account access is protected with Firebase authentication.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
