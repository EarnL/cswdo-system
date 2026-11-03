import React from 'react';
import api from '../api';

function LogoutButton({ className = '' }) {
  const handleLogout = async () => {
    try {
      await api.post('/media-session/logout/', {}, { timeout: 5000 });
    } catch (error) {
      // Local sign-out still completes if the server is unavailable.
    }
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('role');
    window.location.href = '/';
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className || 'lgu-button-danger'}
    >
      Logout
    </button>
  );
}

export default LogoutButton;
