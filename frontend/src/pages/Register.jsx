import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const roleOptions = [
  { value: 'staff', label: 'CSWDO Staff' },
  { value: 'cdw', label: 'Child Development Worker' },
  { value: 'cho', label: 'Child Health Officer' },
  { value: 'planning', label: 'City Planning' },
];

const initialFormData = {
  username: '',
  email: '',
  role: 'staff',
  password: '',
  confirm_password: '',
  barangay_id: '',
};

function Register() {
  const [formData, setFormData] = useState(initialFormData);
  const [barangays, setBarangays] = useState([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('error');

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const response = await api.get('/barangays/');
        setBarangays(response.data);
      } catch (error) {
        console.error('Failed to fetch barangays:', error);
      }
    };
    fetchBarangays();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const showError = (nextMessage) => {
    setMessageTone('error');
    setMessage(nextMessage);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setMessage('');

    if (formData.password.length < 8 || formData.confirm_password.length < 8) {
      showError('Password and confirm password must be at least 8 characters long.');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      showError('Passwords do not match.');
      return;
    }

    if (formData.role === 'cdw' && !formData.barangay_id) {
      showError('Please select a barangay for the Child Development Worker role.');
      return;
    }

    const submitData = { ...formData };
    if (formData.role !== 'cdw') {
      delete submitData.barangay_id;
    }

    try {
      await api.post('/register/', submitData);
      setMessageTone('success');
      setMessage('Registration successful. Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/';
      }, 900);
    } catch (err) {
      console.log(err.response?.data || err);

      if (!err.response) {
        showError('Registration failed because the app could not reach the server.');
        return;
      }

      const errors = err.response.data;
      const firstError = Object.values(errors).flat()[0];
      const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
      showError(errorMessage || 'Registration failed. Please check your details.');
    }
  };

  return (
    <div className="login-stage flex min-h-screen flex-col overflow-hidden">
      <div className="login-office-grid" />
      <div className="login-civic-band" />

      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-0 px-4 py-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <section className="login-reveal relative overflow-hidden rounded-t-xl border border-[#c8d8e8] bg-[#0f4b94] shadow-[0_28px_90px_-50px_rgba(15,23,42,0.75)] lg:min-h-[690px] lg:rounded-l-xl lg:rounded-r-none">
          <div className="login-panel-grid opacity-30" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.2),transparent_32%),linear-gradient(145deg,#155fa8_0%,#0f4b94_46%,#073766_100%)]" />
          <div className="absolute inset-x-0 top-0 h-1 bg-[#7bb8e8]" />

          <div className="relative flex min-h-[340px] flex-col justify-between p-6 text-white sm:p-8 lg:min-h-[690px] lg:p-10">
            <div className="flex items-center gap-3 border-b border-white/15 pb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white p-2 shadow-lg">
                <img src="/cswdo_logo.png" alt="CSWDO Lucena City logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100">CSWDO Lucena City</p>
                <p className="text-base font-black text-white">Account Registration</p>
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
                Create verified office access
              </h1>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {['Staff', 'CDW', 'CHO', 'Planning'].map((item) => (
                  <div key={item} className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-sky-50 backdrop-blur">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="login-reveal login-reveal-delay rounded-b-xl border border-[#d8e5f1] bg-white/96 p-5 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.55)] backdrop-blur lg:min-h-[690px] lg:rounded-l-none lg:rounded-r-xl sm:p-8">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-5">
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <img src="/cswdo_logo.png" alt="CSWDO Lucena City logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0f4b94]">User Setup</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Register Account</h2>
              </div>
            </div>

            {message ? (
              <div className={messageTone === 'success' ? 'lgu-alert-success mb-5' : 'lgu-alert-error mb-5'}>
                {message}
              </div>
            ) : null}

            <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Username</span>
                <input
                  type="text"
                  name="username"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="login-field"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Email Address</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="login-field"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">User Role</span>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="login-field"
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            {formData.role === 'cdw' && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Assigned Barangay</span>
                <select
                  name="barangay_id"
                  value={formData.barangay_id}
                  onChange={handleChange}
                  required
                  className="login-field"
                >
                  <option value="">Select barangay</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>
                      {barangay.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
                <input
                  type="password"
                  name="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="login-field"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Confirm Password</span>
                <input
                  type="password"
                  name="confirm_password"
                  placeholder="Re-enter password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  required
                  className="login-field"
                />
              </label>
            </div>

            <button type="submit" className="login-primary-button w-full">
              Register Account
            </button>

            <p className="text-center text-sm text-slate-500">
              Already registered?{' '}
              <Link to="/" className="font-semibold text-[#0f4b94] hover:text-[#0b3b73]">Return to login</Link>
            </p>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Register;
