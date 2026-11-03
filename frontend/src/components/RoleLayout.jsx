import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';
import HeaderProfileChip from './HeaderProfileChip';
import { NotificationProvider } from './NotificationContext';
import api from '../api';
import './CHOWorkspace.css';

const roleInfo = {
  cdw: {
    title: 'CDW',
    icon: 'profile',
    fullTitle: 'Child Development Worker',
    navItems: [
      { section: 'Main', label: 'Dashboard', icon: 'dashboard', href: '/cdw' },
      { section: 'Main', label: 'Notifications', icon: 'bell', href: '/cdw/notifications' },
      { section: 'Records', label: 'Center Information', icon: 'building', href: '/cdw/cdc-information' },
      { section: 'Records', label: 'Accreditation Requirements', icon: 'shield', href: '/cdw/accreditation-requirements' },
      { section: 'Records', label: 'Child Profiles', icon: 'children', href: '/cdw/students' },
      { section: 'Records', label: 'Monitoring Reports', icon: 'reports', href: '/cdw/reports' },
      { section: 'Records', label: 'Center Reports', icon: 'reports', href: '/cdw/cdc-reports' },
      { section: 'Programs', label: 'Accreditation', icon: 'shield', href: '/cdw/accreditation' },
      { section: 'Programs', label: 'Regular Programs', icon: 'programs', href: '/cdw/regular-programs' },
      { section: 'Programs', label: 'Curriculum Implementation', icon: 'curriculum', href: '/cdw/curriculum-assessment' },
      { section: 'Programs', label: 'Special Needs', icon: 'children', href: '/cdw/special-needs' },
      { section: 'Account', label: 'My Profile', icon: 'profile', href: '/cdw/profile' },
    ],
  },
  staff: {
    title: 'STAFF',
    icon: 'users',
    fullTitle: 'CSWDO Staff',
    navItems: [
      { section: 'Main', label: 'Dashboard', icon: 'dashboard', href: '/staff' },
      { section: 'Main', label: 'Notifications', icon: 'bell', href: '/staff/notifications' },
      { section: 'Records', label: 'Child Development Centers', icon: 'building', href: '/staff/daycare-centers' },
      { section: 'Records', label: 'Population Data', icon: 'population', href: '/staff/population-data' },
      { section: 'Records', label: 'Data Requests', icon: 'reports', href: '/staff/data-requests' },
      { section: 'Records', label: 'Monitoring Reports', icon: 'reports', href: '/staff/reports' },
      { section: 'Records', label: 'Center Reports', icon: 'reports', href: '/staff/cdc-reports' },
      { section: 'Analytics', label: 'Population & Center Map', icon: 'heatmap', href: '/staff/population-map' },
      { section: 'Analytics', label: 'Service Coverage Gaps', icon: 'gap', href: '/staff/service-gap-analytics' },
      { section: 'Analytics', label: 'National Standards Comparison', icon: 'trophy', href: '/staff/national-benchmark' },
      { section: 'Programs', label: 'Program Overview', icon: 'programs', href: '/staff/operations' },
      { section: 'Programs', label: 'Special Needs Results', icon: 'children', href: '/staff/operations/special-needs' },
      { section: 'Programs', label: 'Accreditation', icon: 'shield', href: '/staff/accreditation' },
      { section: 'Programs', label: 'Regular Programs', icon: 'programs', href: '/staff/regular-programs' },
      { section: 'Programs', label: 'Curriculum Review', icon: 'curriculum', href: '/staff/curriculum-assessment' },
      { section: 'Account', label: 'My Profile', icon: 'profile', href: '/staff/profile' },
    ],
  },
  cho: {
    title: 'CHO',
    icon: 'children',
    fullTitle: 'City Health Office',
    navItems: [
      { section: 'Main', label: 'Dashboard', icon: 'dashboard', href: '/cho' },
      { section: 'Main', label: 'Notifications', icon: 'bell', href: '/cho/notifications' },
      { section: 'Main', label: 'Data Requests', icon: 'reports', href: '/cho/data-requests' },
      { section: 'Main', label: 'My Submissions', icon: 'upload', href: '/cho/submissions' },
      { section: 'Account', label: 'My Profile', icon: 'profile', href: '/cho/profile' },
    ],
  },
  planning: {
    title: 'PLANNING',
    icon: 'map',
    fullTitle: 'City Planning Office',
    navItems: [
      { section: 'Main', label: 'Review Dashboard', icon: 'population', href: '/planning' },
      { section: 'Main', label: 'Notifications', icon: 'bell', href: '/planning/notifications' },
      { section: 'Population Review', label: 'Data Requests', icon: 'reports', href: '/planning/data-requests' },
      { section: 'Monitoring', label: 'Population & Center Map', icon: 'heatmap', href: '/planning/population-map' },
      { section: 'Monitoring', label: 'Service Coverage Overview', icon: 'gap', href: '/planning/service-coverage' },
      { section: 'Account', label: 'My Profile', icon: 'profile', href: '/planning/profile' },
    ],
  },
};

function RoleLayout({ role, children }) {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = window.localStorage.getItem('cswdoSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [cdwGrantReady, setCdwGrantReady] = useState(true);

  useEffect(() => {
    window.localStorage.setItem('cswdoSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (role !== 'cdw') return;
    let mounted = true;
    async function loadGrantStatus() {
      try {
        const response = await api.get('/cdcs/', { params: { assigned_to_me: true } });
        const assignedCdc = Array.isArray(response.data) ? response.data[0] : null;
        if (mounted) setCdwGrantReady(Boolean(assignedCdc?.has_valid_grant_to_operate));
      } catch (error) {
        if (mounted) setCdwGrantReady(false);
      }
    }
    loadGrantStatus();
    return () => {
      mounted = false;
    };
  }, [role]);

  const info = roleInfo[role] || roleInfo.staff;
  const profileHref = {
    cdw: '/cdw/profile',
    staff: '/staff/profile',
    cho: '/cho/profile',
    planning: '/planning/profile',
  }[role] || '/admin/profile';

  const layoutMarginClass = isSidebarCollapsed ? 'ml-20' : 'ml-20 lg:ml-72';
  const cdwPreGrantAllowed = new Set([
    '/cdw',
    '/cdw/notifications',
    '/cdw/accreditation-requirements',
    '/cdw/accreditation',
    '/cdw/profile',
  ]);
  const visibleNavItems = role === 'cdw' && !cdwGrantReady
    ? info.navItems.filter((item) => cdwPreGrantAllowed.has(item.href))
    : info.navItems;

  return (
    <NotificationProvider>
    <div className={`lgu-shell h-screen overflow-hidden ${role === 'cho' ? 'cho-workspace' : ''}`}>
      <Sidebar
        navItems={visibleNavItems}
        subtitle={info.fullTitle}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className={`${layoutMarginClass} flex h-screen flex-col overflow-y-auto transition-all duration-300`}>
        <header className="app-header-enter sticky top-0 z-20 border-b border-brand-border bg-brand-soft shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-hover">{info.fullTitle}</p>
                <h1 className="truncate text-xl font-bold text-brand-navy sm:text-2xl">{info.title} Workspace</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <NotificationBell />
              <div className="hidden items-center gap-3 sm:flex">
                <HeaderProfileChip
                  href={profileHref}
                  variant="role"
                  fallbackTitle={info.title}
                  fallbackSubtitle="Active"
                />
              </div>
              <LogoutButton className="lgu-button-danger" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4">
          <div key={location.pathname} className="app-page-enter motion-stagger">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}

export default RoleLayout;
