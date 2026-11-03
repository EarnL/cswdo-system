import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';
import HeaderProfileChip from './HeaderProfileChip';
import { NotificationProvider } from './NotificationContext';

function AdminLayout() {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = window.localStorage.getItem('cswdoSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    window.localStorage.setItem('cswdoSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  const navItems = [
    { section: 'Main', href: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { section: 'Main', href: '/admin/notifications', label: 'Notifications', icon: 'bell' },
    { section: 'Records', href: '/admin/daycare-centers', label: 'Child Development Centers', icon: 'building' },
    { section: 'Records', href: '/admin/reports', label: 'Monitoring Reports', icon: 'reports' },
    { section: 'Records', href: '/admin/cdc-reports', label: 'Center Reports', icon: 'reports' },
    { section: 'Records', href: '/admin/population-data', label: 'Population Data', icon: 'population' },
    { section: 'Records', href: '/admin/data-requests', label: 'Data Requests', icon: 'reports' },
    { section: 'Analytics', href: '/admin/population-map', label: 'Population & Center Map', icon: 'map' },
    { section: 'Analytics', href: '/admin/service-gap-analytics', label: 'Service Coverage Gaps', icon: 'gap' },
    { section: 'Analytics', href: '/admin/analytics', label: 'Center Performance', icon: 'analytics' },
    { section: 'Analytics', href: '/admin/predictive-analytics', label: 'Predictive Analytics', icon: 'forecast' },
    { section: 'Analytics', href: '/admin/national-benchmark', label: 'National Standards Comparison', icon: 'trophy' },
    { section: 'Programs', href: '/admin/accreditation', label: 'Accreditation', icon: 'shield' },
    { section: 'Programs', href: '/admin/programs', label: 'Program Overview', icon: 'programs' },
    { section: 'Programs', href: '/admin/curriculum-assessment', label: 'Curriculum Monitoring', icon: 'curriculum' },
    { section: 'Programs', href: '/admin/snp', label: 'SNP Planning', icon: 'nutrition' },
    { section: 'Administration', href: '/admin/users', label: 'Users & Roles', icon: 'users' },
    { section: 'Administration', href: '/admin/cdc-registration', label: 'Register a Center', icon: 'registration' },
    { section: 'Account', href: '/admin/profile', label: 'My Profile', icon: 'profile' },
  ];

  const layoutMarginClass = isSidebarCollapsed ? 'ml-20' : 'ml-20 lg:ml-72';

  return (
    <NotificationProvider>
    <div className="lgu-shell h-screen overflow-hidden">
      <Sidebar
        navItems={navItems}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className={`${layoutMarginClass} flex h-screen flex-col overflow-y-auto transition-all duration-300`}>
        <header className="app-header-enter sticky top-0 z-20 border-b border-brand-border bg-brand-soft shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-hover">CSWDO Lucena City</p>
                <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">Admin Workspace</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="hidden items-center gap-3 sm:flex">
                <HeaderProfileChip
                  href="/admin/profile"
                  variant="admin"
                  fallbackTitle="Admin"
                  fallbackSubtitle="Lucena City"
                />
              </div>
              <LogoutButton className="lgu-button-danger" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4">
          <div key={location.pathname} className="app-page-enter motion-stagger">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}

export default AdminLayout;
