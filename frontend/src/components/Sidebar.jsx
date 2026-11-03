import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import AppIcon from './AppIcon';
import { useNotifications } from './NotificationContext';

const sectionIcons = { Records: 'reports', Analytics: 'analytics', Monitoring: 'analytics', 'Population Review': 'population', Programs: 'programs', Administration: 'users' };
const isWithin = (pathname, href) => pathname === href || pathname.startsWith(`${href}/`);

function Sidebar({ navItems = [], collapsed = false, onToggle, subtitle = 'Childcare Support System' }) {
  const { pathname } = useLocation();
  const { data: notificationData } = useNotifications();
  const unreadCount = Math.max(0, Number(notificationData.unread_count) || 0);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const expanded = mobile ? mobileOpen : !collapsed;
  // Prefer the most specific destination so a parent and child cannot both be selected.
  const activeItem = navItems.filter((item) => isWithin(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const activeSection = activeItem?.section;

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => { setMobile(query.matches); setMobileOpen(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (activeSection) setOpenGroups((current) => ({ ...current, [activeSection]: true }));
    setMobileOpen(false);
  }, [pathname, activeSection]);

  const toggleSidebar = () => mobile ? setMobileOpen((value) => !value) : onToggle?.();
  const groups = navItems.reduce((result, item) => {
    if (!item.section || item.section === 'Main' || item.section === 'Account') return result;
    const group = result.find((entry) => entry.section === item.section);
    if (group) group.items.push(item);
    else result.push({ section: item.section, items: [item] });
    return result;
  }, []);
  const directItems = navItems.filter((item) => !item.section || item.section === 'Main');
  const accountItems = navItems.filter((item) => item.section === 'Account');
  const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-hover focus-visible:ring-offset-2 focus-visible:ring-offset-brand-soft';

  const renderLink = (item, nested = false) => {
    const active = activeItem?.href === item.href;
    const showBadge = item.href.endsWith('/notifications') && unreadCount > 0;
    return (
      <li key={item.href}>
        <NavLink to={item.href} end={active} aria-current={active ? 'page' : false} title={item.label} aria-label={item.label} aria-describedby={showBadge ? 'sidebar-unread-count' : undefined}
          onClick={() => setMobileOpen(false)}
          className={`relative flex items-center gap-3 ${!expanded ? 'justify-center' : ''} rounded-r-full transition-colors ${nested ? 'min-h-10 py-2 pl-12 pr-4 text-[13px]' : 'min-h-12 px-5 py-3 text-sm'} ${focusClass} ${active ? 'bg-brand-navy font-medium text-white shadow-[inset_3px_0_0_var(--brand-gold)]' : 'text-slate-600 hover:bg-brand-tint hover:text-brand-navy'}`}>
          <span className={`shrink-0 ${active ? 'text-brand-gold' : 'text-brand-hover'}`} aria-hidden="true"><AppIcon name={item.icon} className={nested ? 'h-4 w-4' : 'h-5 w-5'} /></span>
          {expanded && <span className="min-w-0 flex-1 leading-5">{item.label}</span>}
          {showBadge && <span id="sidebar-unread-count" aria-label={`${unreadCount} unread notifications`}
            className={`${expanded ? 'ml-auto' : 'absolute right-1 top-1'} inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-red ring-2 ring-white px-1.5 text-[10px] font-semibold tabular-nums text-white`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>}
        </NavLink>
      </li>
    );
  };

  return (
    <>
      {mobile && expanded && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40" />}
      <aside aria-label="Sidebar" onKeyDown={(event) => {
        if (event.key === 'Escape' && mobileOpen) { setMobileOpen(false); document.getElementById('sidebar-toggle')?.focus(); }
      }} className={`cswdo-sidebar fixed inset-y-0 left-0 z-40 ${expanded ? 'w-72 max-w-[calc(100vw-2rem)]' : 'w-20'} flex flex-col overflow-hidden border-r border-brand-border bg-brand-soft text-slate-700 transition-all duration-300`}>
        <div className={`flex min-h-24 items-center border-b-2 border-brand-gold bg-brand-navy ${expanded ? 'gap-2 px-5 py-5' : 'flex-col gap-3 px-3 py-4'}`}>
          <img src="/cswdo_logo.png" alt="CSWDO Lucena City logo" className="h-9 w-9 shrink-0 object-contain" />
          {expanded && <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-semibold tracking-tight text-white">CSWDO Lucena City</h2>
            <p className="mt-1 text-[10px] leading-4 text-slate-300">{subtitle}</p>
          </div>}
          <button id="sidebar-toggle" type="button" onClick={toggleSidebar} aria-expanded={expanded} aria-controls="sidebar-navigation"
            title={expanded ? 'Collapse navigation' : 'Expand navigation'} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-brand-hover hover:text-white ${focusClass}`}>
            <AppIcon name={expanded ? 'chevronLeft' : 'chevronRight'} className="h-4 w-4" />
          </button>
        </div>
        <nav id="sidebar-navigation" aria-label="Main navigation" className={`min-h-0 flex-1 overflow-y-auto py-5 ${expanded ? 'pr-4' : ''}`}>
          <ul className="space-y-1">{directItems.map((item) => renderLink(item))}</ul>
          {groups.length > 0 && <ul className="mt-2 space-y-1">
            {groups.map((group) => {
              const open = expanded && Boolean(openGroups[group.section]);
              const active = activeSection === group.section;
              const id = `nav-${group.section.toLowerCase().replace(/\s+/g, '-')}`;
              return <li key={group.section}>
                <button type="button" title={group.section} aria-label={group.section} aria-expanded={open} aria-controls={id}
                  onClick={() => {
                    if (!expanded) { if (mobile) setMobileOpen(true); else onToggle?.(); }
                    setOpenGroups((current) => ({ ...current, [group.section]: !expanded || !current[group.section] }));
                  }}
                  className={`flex min-h-12 w-full items-center gap-3 ${!expanded ? 'justify-center' : ''} rounded-r-full px-5 py-3 text-left text-sm transition-colors ${focusClass} ${active ? 'bg-brand-cream font-medium text-brand-navy' : 'text-slate-600 hover:bg-brand-tint hover:text-brand-navy'}`}>
                  <AppIcon name={sectionIcons[group.section] || 'reports'} className="h-5 w-5 shrink-0 text-brand-hover" />
                  {expanded && <><span className="flex-1">{group.section}</span><AppIcon name="chevronRight" className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} /></>}
                </button>
                <ul id={id} hidden={!open} className="mb-3 mt-1 space-y-0.5">
                  {group.items.map((item) => renderLink(item, true))}
                </ul>
              </li>;
            })}
          </ul>}
        </nav>
        {accountItems.length > 0 && <div className={`border-t border-brand-border py-3 ${expanded ? 'pr-4' : ''}`}><ul className="space-y-1">{accountItems.map((item) => renderLink(item))}</ul></div>}
      </aside>
    </>
  );
}

export default Sidebar;
