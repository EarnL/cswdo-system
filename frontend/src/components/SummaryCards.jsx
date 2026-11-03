import React from 'react';
import AppIcon from './AppIcon';

export default function SummaryCards({ data, loading }) {
  const cards = [
    { label: 'CDC Centers', value: data.totalCdcs, hint: 'Registered centers', icon: 'building', tone: 'sky' },
    { label: 'Children', value: data.totalChildren, hint: 'Current enrollment', icon: 'children', tone: 'emerald' },
    { label: 'Barangays', value: data.totalBarangays, hint: 'Covered areas', icon: 'barangay', tone: 'amber' },
    { label: 'Avg. Score', value: `${Number(data.avgPerformance || 0).toFixed(1)}%`, hint: 'Latest performance', icon: 'score', tone: 'rose' },
  ];

  return (
    <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="lgu-card summary-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="lgu-kicker">{card.label}</h2>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {loading ? '...' : card.value}
              </p>
            </div>
            <span className={`summary-card-icon summary-card-icon-${card.tone}`}>
              <AppIcon name={card.icon} className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}
