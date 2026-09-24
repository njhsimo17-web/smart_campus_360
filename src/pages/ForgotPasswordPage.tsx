import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.2),_transparent_50%),_#020617] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/85 p-8 shadow-2xl shadow-slate-950/40"
      >
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 p-2 text-slate-300 hover:bg-slate-800 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
            <KeyRound size={22} />
          </div>
          <div>
            <p className="text-sm text-cyan-400">Password Recovery</p>
            <h2 className="text-xl font-semibold text-white">Reset Password</h2>
          </div>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-6 text-center">
              <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-semibold text-white">Email Sent!</p>
              <p className="mt-2 text-sm text-slate-300">
                We've sent a password reset link to your email. Please check your inbox.
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="University email"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              Remember your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-cyan-400 hover:text-cyan-300 transition font-medium"
              >
                Sign In
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
