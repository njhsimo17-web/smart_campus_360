import { useState, type FormEvent, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SmartCampusLogo from '../components/SmartCampusLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, userRole, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.registrationMessage) {
      setSuccessMessage(location.state.registrationMessage as string);
    }
  }, [location.state]);

  // Role-based redirect after login
  useEffect(() => {
    if (userRole && userData) {
      const isPendingApproval = userData.status === 'pending' || userData.status === 'Pending Approval';
      const isRejected = userData.status === 'rejected' || userData.status === 'Rejected';

      if (userRole === 'student') {
        if (isRejected) {
          setError('Registration rejected. Please contact administration.');
          return;
        }
        if (isPendingApproval) {
          navigate('/registration-pending');
        } else {
          navigate('/student/dashboard');
        }
      } else if (userRole === 'professor') {
        navigate('/professor/dashboard');
      } else if (userRole === 'admin') {
        navigate('/admin/dashboard');
      }
    }
  }, [userRole, userData, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      console.log('Firebase login success');
      console.log('User role:', result.role);

      if (!result.userData) {
        setError('User profile not found in Firestore.');
        setLoading(false);
        return;
      }

      const status = result.userData.status?.toString().toLowerCase();
      if (result.role === 'student') {
        if (status === 'rejected') {
          setError('Registration rejected. Please contact administration.');
          setLoading(false);
          return;
        }
        if (status === 'pending' || status === 'pending approval') {
          navigate('/registration-pending');
          return;
        }
        navigate('/student/dashboard');
        return;
      }

      if (result.role === 'professor') {
        navigate('/professor/dashboard');
        return;
      }

      if (result.role === 'admin') {
        navigate('/admin/dashboard');
        return;
      }
    } catch (err: any) {
      const code = err?.code;
      let message = 'Failed to sign in. Please check your credentials.';

      switch (code) {
        case 'auth/user-not-found':
          message = 'No account found for this email.';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-credential':
          message = 'Invalid email or password.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many attempts. Please try again later.';
          break;
        default:
          message = err?.message || message;
      }

      setError(message);
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
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <SmartCampusLogo size="lg" />
          <div>
            <p className="text-sm text-cyan-400">Smart Campus Platform</p>
            <h2 className="text-xl font-semibold text-white">Secure Sign In</h2>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
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
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500/50"
              required
            />
          </div>

          <div className="flex items-center justify-between text-sm text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-500" />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-cyan-400 hover:text-cyan-300 transition"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <button
            onClick={() => navigate('/register')}
            className="text-cyan-400 hover:text-cyan-300 transition font-medium"
          >
            Register as Student
          </button>
        </div>
      </motion.div>
    </div>
  );
}
