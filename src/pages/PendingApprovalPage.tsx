import { motion } from 'framer-motion';
import { Clock, User, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import SmartCampusLogo from '../components/SmartCampusLogo';

export default function PendingApprovalPage() {
  const warning = (useLocation().state as { registrationWarning?: string } | null)?.registrationWarning;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md rounded-3xl border border-slate-800 bg-slate-900/85 p-8 text-center"
      >
        <SmartCampusLogo size="lg" className="mb-5" />
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15">
          <Clock size={40} className="text-amber-400" />
        </div>
        
        <h1 className="mb-2 text-2xl font-semibold text-white">Registration Pending</h1>
        <p className="mb-6 text-slate-400">
          Your registration is currently under review by the administration. You will be notified once your account is approved.
        </p>
        {warning && <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{warning}</div>}

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <User size={18} className="text-slate-400" />
            <span className="text-sm text-slate-300">Student Account</span>
          </div>
          
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <CheckCircle2 size={18} className="text-amber-400" />
            <span className="text-sm text-slate-300">Awaiting Approval</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <p className="text-sm text-cyan-300">
            Please check your email for updates. You can also contact the administration for more information.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
