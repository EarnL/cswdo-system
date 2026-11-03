import React from 'react';

function Footer() {
  return (
    <footer className="app-footer mt-10 bg-white text-slate-900">
      <div className="mx-auto max-w-7xl rounded-lg border border-slate-200 bg-white px-6 py-10 shadow-[0_18px_55px_-42px_rgba(15,23,42,0.20)] sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#0f4b94]">City Social Welfare and Development Office</p>
            <h2 className="mt-4 text-3xl font-black text-slate-950">CSWDO Lucena City</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              Public daycare coverage dashboard for barangay-level planning and service monitoring.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Service Focus</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  CDC monitoring, accreditation, feeding programs, child population data, and service gap analysis.
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Public Insight</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Barangay population, CDC coverage, and daycare service need signals for planning.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-5">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">About This System</h3>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              Provides a secure staff portal and public dashboard for daycare service monitoring and planning.
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex sm:items-center sm:justify-between">
          <p>Public daycare coverage dashboard for barangay-level planning and service monitoring.</p>
          <p>&copy; 2026 CSWDO Lucena City</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
