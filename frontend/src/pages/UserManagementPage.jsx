import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { TableSkeleton } from '../components/LoadingState';

const roleOptions = [
  { value: 'all', label: 'All System Users', shortLabel: 'All', accent: 'from-slate-700 to-slate-950', surface: 'bg-slate-50', ring: 'ring-slate-200' },
  { value: 'admin', label: 'CSWDO Admin', shortLabel: 'Admin', accent: 'from-sky-600 to-blue-700', surface: 'bg-sky-50', ring: 'ring-sky-200' },
  { value: 'staff', label: 'CSWDO Staff', shortLabel: 'Staff', accent: 'from-emerald-600 to-teal-700', surface: 'bg-emerald-50', ring: 'ring-emerald-200' },
  { value: 'cdw', label: 'Child Development Workers', shortLabel: 'CDW', accent: 'from-violet-600 to-indigo-700', surface: 'bg-violet-50', ring: 'ring-violet-200' },
  { value: 'cho', label: 'City Health Office Users', shortLabel: 'CHO', accent: 'from-rose-600 to-red-700', surface: 'bg-rose-50', ring: 'ring-rose-200' },
  { value: 'planning', label: 'City Planning Office Users', shortLabel: 'Planning', accent: 'from-amber-500 to-orange-700', surface: 'bg-amber-50', ring: 'ring-amber-200' },
];

const emptyForm = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  role: 'staff',
  cdc_id: '',
  department: '',
};

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

function formatError(err, fallback) {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' ');
}

function fullName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
}

function initialsFor(user) {
  const names = [user.first_name, user.last_name].filter(Boolean);
  if (names.length) {
    return names.map((name) => name[0]).join('').slice(0, 2).toUpperCase();
  }
  return (user.username || '?').slice(0, 2).toUpperCase();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

function officeLabel(user) {
  if (user.role === 'cho') return user.department || 'City Health Office';
  if (user.role === 'planning') return user.department || 'City Planning Office';
  if (user.role === 'admin' || user.role === 'staff') return user.department || 'CSWDO';
  return user.department || 'Assigned CDC';
}

function roleLabel(role) {
  return roleOptions.find((item) => item.value === role)?.shortLabel || role || 'Staff';
}

function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [cdcs, setCdcs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [passwordForm, setPasswordForm] = useState({ password: '' });
  const [modal, setModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingId, setSavingId] = useState(null);

  const cdcOptions = useMemo(
    () => cdcs.map((cdc) => ({
      id: cdc.id,
      label: `${cdc.name}${cdc.barangay_name ? ` - ${cdc.barangay_name}` : ''}`,
    })),
    [cdcs],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const assignedCdc = user.assigned_cdc?.name || '';
      const haystack = [
        fullName(user),
        user.username,
        user.email,
        user.role,
        roleLabel(user.role),
        user.department,
        assignedCdc,
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;
      const matchesStatus =
        statusFilter === 'all'
        || (statusFilter === 'active' && user.is_active)
        || (statusFilter === 'inactive' && !user.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, selectedRole, statusFilter]);

  const roleSummaries = useMemo(() => (
    roleOptions.map((role) => ({
      ...role,
      total: role.value === 'all' ? users.length : users.filter((user) => user.role === role.value).length,
      active: role.value === 'all' ? users.filter((user) => user.is_active).length : users.filter((user) => user.role === role.value && user.is_active).length,
    }))
  ), [users]);

  const activeRole = roleOptions.find((role) => role.value === selectedRole) || roleOptions[0];

  const unassignedCdcs = useMemo(() => {
    const assignedCdcIds = new Set(
      users
        .filter((user) => user.role === 'cdw' && user.is_active && user.assigned_cdc?.id)
        .map((user) => user.assigned_cdc.id)
    );
    return cdcs.filter((cdc) => !assignedCdcIds.has(cdc.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, cdcs]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [usersResponse, cdcsResponse] = await Promise.all([
        api.get('/users/'),
        api.get('/cdcs/'),
      ]);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setCdcs(Array.isArray(cdcsResponse.data) ? cdcsResponse.data : []);
    } catch (err) {
      setError(formatError(err, 'Failed to load user management data.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleFormChange = (event, setter = setForm) => {
    const { name, value } = event.target;
    setter((current) => ({
      ...current,
      [name]: value,
      ...(name === 'role' && value !== 'cdw' ? { cdc_id: '' } : {}),
      ...(name === 'role' && value === 'cho' ? { department: current.department || 'City Health Office' } : {}),
      ...(name === 'role' && value === 'planning' ? { department: current.department || 'City Planning Office' } : {}),
      ...(name === 'role' && ['admin', 'staff'].includes(value) ? { department: current.department || 'CSWDO' } : {}),
    }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setSelectedUser(null);
    setModal('create');
    setError('');
    setSuccess('');
  };

  const openDetails = (user) => {
    setSelectedUser(user);
    setModal('details');
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username || '',
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      password: '',
      role: user.role || 'staff',
      cdc_id: user.assigned_cdc?.id || '',
      department: user.department || '',
    });
    setModal('edit');
    setError('');
    setSuccess('');
  };

  const openPassword = (user) => {
    setSelectedUser(user);
    setPasswordForm({ password: '' });
    setModal('password');
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setModal(null);
    setSelectedUser(null);
    setPasswordForm({ password: '' });
  };

  const createUser = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...form,
        cdc_id: form.role === 'cdw' ? Number(form.cdc_id) : null,
      };
      const response = await api.post('/users/', payload);
      setUsers((current) => [...current, response.data].sort((a, b) => a.username.localeCompare(b.username)));
      closeModal();
      setSuccess('User account created. Share the temporary password through an approved internal channel.');
    } catch (err) {
      setError(formatError(err, 'Failed to create the user account.'));
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (user, changes, message = 'User account updated.') => {
    setSavingId(user.id);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch(`/users/${user.id}/`, changes);
      setUsers((current) => current.map((item) => (item.id === user.id ? response.data : item)));
      setSelectedUser(response.data);
      setSuccess(message);
      return response.data;
    } catch (err) {
      setError(formatError(err, 'Failed to update the user account.'));
      return null;
    } finally {
      setSavingId(null);
    }
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    const payload = {
      username: editForm.username,
      email: editForm.email,
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      role: editForm.role,
      department: editForm.department,
      cdc_id: editForm.role === 'cdw' ? Number(editForm.cdc_id) : null,
    };
    const updated = await updateUser(selectedUser, payload);
    if (updated) closeModal();
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    const updated = await updateUser(
      selectedUser,
      { password: passwordForm.password },
      `Temporary password reset for ${selectedUser.username}.`,
    );
    if (updated) closeModal();
  };

  const setAccountStatus = async (user, isActive) => {
    if (isActive) {
      await updateUser(user, { is_active: true }, `${user.username} has been activated.`);
      return;
    }

    setSavingId(user.id);
    setError('');
    setSuccess('');
    try {
      const response = await api.delete(`/users/${user.id}/`);
      setUsers((current) => current.map((item) => (item.id === user.id ? response.data : item)));
      setSuccess(`${user.username} has been deactivated.`);
    } catch (err) {
      setError(formatError(err, 'Failed to deactivate the user account.'));
    } finally {
      setSavingId(null);
    }
  };

  const renderUserForm = (currentForm, onChange, onSubmit, submitLabel, submitting) => (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-slate-700">Username</span>
        <input name="username" value={currentForm.username} onChange={onChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-slate-700">Official Email</span>
        <input name="email" type="email" value={currentForm.email} onChange={onChange} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-slate-700">First Name</span>
        <input name="first_name" value={currentForm.first_name} onChange={onChange} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-slate-700">Last Name</span>
        <input name="last_name" value={currentForm.last_name} onChange={onChange} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      {modal === 'create' ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-slate-700">Temporary Password</span>
          <input name="password" type="password" value={currentForm.password} onChange={onChange} required minLength={8} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-slate-700">Role</span>
        <select name="role" value={currentForm.role} onChange={onChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
      </label>
      {currentForm.role === 'cdw' ? (
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-slate-700">Assigned CDC</span>
          <select name="cdc_id" value={currentForm.cdc_id} onChange={onChange} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">Select CDC</option>
            {cdcOptions.map((cdc) => (
              <option key={cdc.id} value={cdc.id}>{cdc.label}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-slate-700">Office / Department</span>
          <input name="department" value={currentForm.department} onChange={onChange} placeholder="Office or department" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      )}
      {currentForm.role !== 'cdw' ? (
        <p className="sm:col-span-2 text-sm text-slate-500">Ensure this account is assigned to the correct office or department for approval workflows.</p>
      ) : (
        <p className="sm:col-span-2 text-sm text-slate-500">CDW accounts require an assigned CDC to be created.</p>
      )}
      <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
        <button type="button" onClick={closeModal} className="lgu-button-secondary">Cancel</button>
        <button type="submit" disabled={submitting} className="lgu-button-primary">{submitting ? 'Saving...' : submitLabel}</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_20px_70px_-48px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="lgu-kicker">User and Role Management</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Account Control Center</h1>
            <p className="mt-1 text-sm text-slate-500">
              Select a role group, then manage only the users assigned to that office workflow.
            </p>
          </div>
          <button type="button" onClick={openCreate} className="lgu-button-primary whitespace-nowrap">
            Create User Account
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {roleSummaries.map((role) => {
            const selected = selectedRole === role.value;
            const isAllUsers = role.value === 'all';
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={`group overflow-hidden rounded-lg border p-0 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${isAllUsers ? 'sm:col-span-2 xl:col-span-3 2xl:col-span-6' : ''} ${
                  selected ? `border-transparent shadow-lg ring-2 ${role.ring}` : 'border-slate-200 bg-slate-50/80'
                }`}
              >
                <div className={`h-1.5 bg-gradient-to-r ${role.accent}`} />
                <div className={`${selected ? role.surface : 'bg-white'} ${isAllUsers ? 'p-3' : 'p-4'}`}>
                  <div className={`${isAllUsers ? 'flex flex-wrap items-center justify-between gap-3' : 'flex items-start justify-between gap-3'}`}>
                    <div className={isAllUsers ? 'flex min-w-0 items-center gap-3' : ''}>
                      {isAllUsers ? (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                          All
                        </span>
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase text-slate-500">{role.shortLabel}</p>
                        <h2 className={`${isAllUsers ? 'text-sm' : 'mt-1 text-sm'} font-black text-slate-950`}>{role.label}</h2>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 ${isAllUsers ? 'text-xs' : ''}`}>
                      <span className={`rounded-full px-3 py-1 font-black ${selected ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-700'} ${isAllUsers ? 'text-xs' : 'text-sm'}`}>
                        {role.total} total
                      </span>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                        {role.active} active
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {Math.max(role.total - role.active, 0)} inactive
                      </span>
                    </div>
                  </div>
                  {!isAllUsers ? (
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>{role.active} active</span>
                      <span>{Math.max(role.total - role.active, 0)} inactive</span>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {success ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${activeRole.shortLabel} users by name, username, email, CDC, or office`}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#0f4b94] focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" onClick={loadData} className="lgu-button-secondary">Refresh</button>
        </div>
      </section>

      {loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_55px_-38px_rgba(15,23,42,0.45)]">
          <div className={`h-2 bg-gradient-to-r ${activeRole.accent}`} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">{activeRole.label}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredUsers.length} shown from {roleSummaries.find((role) => role.value === activeRole.value)?.total || 0} total account{filteredUsers.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                {(roleSummaries.find((role) => role.value === activeRole.value)?.active || 0)} active
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                {filteredUsers.length} visible
              </span>
            </div>
          </div>

          {selectedRole === 'all' && unassignedCdcs.length > 0 ? (
            <section className="m-4 overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-[0_18px_45px_-36px_rgba(180,83,9,0.8)]">
              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-xl font-black text-white shadow-sm">
                    ⚠
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black text-amber-950">CDCs Awaiting Account Assignment</p>
                    <p className="mt-1 max-w-3xl text-sm font-medium text-amber-800">
                      These CDCs are registered, but still need an active Child Development Worker account.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-3xl font-black text-amber-700">{unassignedCdcs.length}</p>
                  <p className="text-xs font-black uppercase text-amber-800">Pending CDC{unassignedCdcs.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="border-t border-amber-100 bg-white/75 p-4">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {unassignedCdcs.map((cdc) => (
                    <div key={cdc.id} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2.5 shadow-sm">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{cdc.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...emptyForm, role: 'cdw', cdc_id: String(cdc.id) });
                          setSelectedUser(null);
                          setModal('create');
                          setError('');
                          setSuccess('');
                        }}
                        className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-amber-700"
                      >
                        Create Account
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {filteredUsers.length ? (
            <div className="space-y-2 p-4">
              {filteredUsers.map((user) => (
                <article key={user.id} className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-md">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.8fr)_auto] lg:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      {user.profile_picture_url ? (
                        <img
                          src={user.profile_picture_url}
                          alt={`${fullName(user)} profile`}
                          className="h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                        />
                      ) : (
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${activeRole.accent} text-xs font-black text-white shadow-sm`}>
                          {initialsFor(user)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-black text-slate-950">{fullName(user)}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700">{roleLabel(user.role)}</span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{user.email || user.username} · @{user.username}</p>
                      </div>
                    </div>

                    <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2 text-xs">
                      <p className="truncate font-black text-slate-700">
                        {user.role === 'cdw' ? user.assigned_cdc?.name || 'No CDC assigned' : officeLabel(user)}
                      </p>
                      <p className="mt-0.5 truncate text-slate-500">Last login: {formatDate(user.last_login)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <button type="button" onClick={() => openDetails(user)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">View</button>
                      <button type="button" onClick={() => openEdit(user)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">Edit</button>
                      <button type="button" onClick={() => openPassword(user)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">Password</button>
                      <button
                        type="button"
                        disabled={savingId === user.id}
                        onClick={() => setAccountStatus(user, !user.is_active)}
                        className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${user.is_active ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="m-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No {activeRole.shortLabel} users match the current filters.
            </div>
          )}
        </section>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="lgu-kicker">{modal === 'create' ? 'New Account' : 'Account Management'}</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  {modal === 'create' && 'Create User Account'}
                  {modal === 'edit' && `Edit ${selectedUser?.username}`}
                  {modal === 'details' && fullName(selectedUser || {})}
                  {modal === 'password' && `Reset Password for ${selectedUser?.username}`}
                </h2>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Close</button>
            </div>

            {modal === 'create' ? renderUserForm(form, (event) => handleFormChange(event, setForm), createUser, 'Create Account', creating) : null}
            {modal === 'edit' ? renderUserForm(editForm, (event) => handleFormChange(event, setEditForm), submitEdit, 'Save Changes', savingId === selectedUser?.id) : null}
            {modal === 'password' ? (
              <form onSubmit={resetPassword} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-slate-700">New Temporary Password</span>
                  <input
                    type="password"
                    value={passwordForm.password}
                    onChange={(event) => setPasswordForm({ password: event.target.value })}
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="lgu-button-secondary">Cancel</button>
                  <button type="submit" disabled={savingId === selectedUser?.id} className="lgu-button-primary">Reset Password</button>
                </div>
              </form>
            ) : null}
            {modal === 'details' && selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  {selectedUser.profile_picture_url ? (
                    <img
                      src={selectedUser.profile_picture_url}
                      alt={`${fullName(selectedUser)} profile`}
                      className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#0f4b94] to-[#16a34a] text-2xl font-black text-white shadow-sm">
                      {initialsFor(selectedUser)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{fullName(selectedUser)}</h3>
                    <p className="text-sm font-semibold text-slate-500">{selectedUser.email || selectedUser.username}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Full Name', fullName(selectedUser)],
                  ['Username', selectedUser.username],
                  ['Email', selectedUser.email || 'No email'],
                  ['Role', roleOptions.find((role) => role.value === selectedUser.role)?.label || selectedUser.role],
                  ['Office / Department', officeLabel(selectedUser)],
                  ['Position', selectedUser.position || 'Not set'],
                  ['Assigned CDC', selectedUser.role === 'cdw' ? selectedUser.assigned_cdc?.name || 'None' : 'Not applicable'],
                  ['Status', selectedUser.is_active ? 'Active' : 'Inactive'],
                  ['Last Login', formatDate(selectedUser.last_login)],
                  ['Created By', selectedUser.created_by_username || 'System'],
                  ['Created At', formatDate(selectedUser.created_at)],
                  ['Updated At', formatDate(selectedUser.updated_at)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
                  </div>
                ))}
                <div className="flex justify-end gap-3 sm:col-span-2">
                  <button type="button" onClick={() => openEdit(selectedUser)} className="lgu-button-secondary">Edit User</button>
                  <button type="button" onClick={() => openPassword(selectedUser)} className="lgu-button-primary">Reset Password</button>
                </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default UserManagementPage;
