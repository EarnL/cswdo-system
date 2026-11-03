import React from 'react';
import LogoutButton from '../components/LogoutButton';

function AdminDashboard() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-green-700">
          Admin Dashboard (CSWDO)
        </h1>
        <LogoutButton />
      </div>
      <p>Full system access, analytics, heatmap, reports.</p>
    </div>
  );
}

export default AdminDashboard;
