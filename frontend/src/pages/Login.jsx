import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { LoadingSpinner } from '../components/LoadingState';

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loginStatus, setLoginStatus] = useState('');

  const redirectBasedOnRole = (role) => {
    const destination = {
      admin: '/admin',
      staff: '/staff',
      cdw: '/cdw',
      cho: '/cho',
      planning: '/planning',
      city_planning: '/planning',
    }[role];
    if (destination) navigate(destination, { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setLoginStatus('Logging in...');

    try {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('role');

      const res = await api.post('/token/', { username: username.trim(), password });
      setLoginStatus('Redirecting...');

      localStorage.setItem('access', res.data.access);
      localStorage.setItem('refresh', res.data.refresh);
      localStorage.setItem('role', res.data.role);
      localStorage.setItem('username', res.data.username || username);

      if (res.data.role === 'cdw' && res.data.selected_barangay) {
        localStorage.setItem('selected_barangay_id', res.data.selected_barangay.id);
        localStorage.setItem('selected_barangay_name', res.data.selected_barangay.name);
      }

      redirectBasedOnRole(res.data.role);
    } catch (err) {
      console.error('Login failed:', err.response?.status, err.response?.data || err.message);
      setLoginStatus('');

      if (!err.response) {
        setError('The app cannot reach the server. Please try again in a moment.');
        return;
      }

      const details = err.response.data;
      const backendMessage =
        details?.detail ||
        details?.non_field_errors?.[0] ||
        details?.username?.[0] ||
        details?.password?.[0];

      setError(backendMessage || `Login failed with server status ${err.response.status}.`);
    }
  };

  const isLoggingIn = Boolean(loginStatus);

  return (
    <div className="login-stage flex min-h-screen flex-col overflow-hidden bg-slate-100">
      <div className="login-office-grid" />
      <div className="login-civic-band" />

      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-0 px-4 py-5 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <section className="login-reveal relative overflow-hidden rounded-t-xl border border-[#c8d8e8] bg-[#0f4b94] shadow-[0_28px_90px_-50px_rgba(15,23,42,0.75)] lg:min-h-[620px] lg:rounded-l-xl lg:rounded-r-none">
          <div className="login-panel-grid opacity-30" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.22),transparent_32%),linear-gradient(145deg,#155fa8_0%,#0f4b94_46%,#073766_100%)]" />
          <div className="absolute inset-x-0 top-0 h-1 bg-[#7bb8e8]" />

          <div className="relative flex min-h-[360px] flex-col justify-between p-6 text-white sm:p-8 lg:min-h-[620px] lg:p-10">
            <div className="flex items-center gap-3 border-b border-white/15 pb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white p-2 shadow-lg">
                <img src="/cswdo_logo.png" alt="CSWDO Lucena City logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100">CSWDO Lucena City</p>
                <p className="text-base font-black text-white">City Government of Lucena</p>
              </div>
            </div>

            <div className="login-seal-dial">
              <div className="login-seal-ring" />
              <div className="login-seal-core">
                <img src="/cswdo_logo.png" alt="" className="h-28 w-28 object-contain" />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
                Secure welfare records portal
              </h1>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {['CDC Records', 'Reports', 'Planning'].map((item) => (
                  <div key={item} className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-sky-50 backdrop-blur">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="login-reveal login-reveal-delay rounded-b-xl border border-[#d8e5f1] bg-white/96 p-5 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.55)] backdrop-blur lg:min-h-[620px] lg:rounded-l-none lg:rounded-r-xl sm:p-8">
          <div className="mx-auto max-w-md">
            <div className="mb-6 border-b border-slate-200 pb-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                    <img src="/cswdo_logo.png" alt="CSWDO Lucena City logo" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0f4b94]">Secure Access</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">Sign in to CSWDO</h2>
                  </div>
                </div>
                <span className="hidden rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#0f4b94] sm:inline-flex">
                  Online
                </span>
              </div>
            </div>

            {error ? <div className="lgu-alert-error mb-5">{error}</div> : null}

            <form onSubmit={handleLogin} className="space-y-4">
              <label className="group block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Username or Email</span>
                <input
                  type="text"
                  placeholder="Enter username or email"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="login-field"
                  disabled={isLoggingIn}
                  required
                />
              </label>

              <label className="group block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Password</span>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="login-field"
                  disabled={isLoggingIn}
                  required
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0f4b94] focus:ring-[#0f4b94]"
                    disabled={isLoggingIn}
                  />
                  Remember this device
                </label>
                <Link to="/" className="font-bold text-[#0f4b94] transition hover:text-[#0b3b73]">Forgot password?</Link>
              </div>

              <button type="submit" disabled={isLoggingIn} className="login-primary-button w-full disabled:cursor-not-allowed disabled:opacity-70">
                {isLoggingIn ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner />
                    {loginStatus}
                  </span>
                ) : (
                  'Log In'
                )}
              </button>
            </form>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Office</p>
                <p className="mt-1 text-sm font-black text-slate-900">CSWDO Admin</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Access</p>
                <p className="mt-1 text-sm font-black text-slate-900">Role-based</p>
              </div>
            </div>

            <p className="mt-5 text-center text-sm text-slate-500">
              Accounts are issued only for verified LGU staff.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;
