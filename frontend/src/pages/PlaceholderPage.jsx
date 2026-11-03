import React from 'react';

function PlaceholderPage({ title, description }) {
  return (
    <div className="max-w-4xl mx-auto rounded-lg bg-white p-8 shadow-sm border border-gray-200">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">{title}</h1>
      <p className="text-gray-600 mb-6">{description}</p>
      <div className="rounded-lg bg-slate-50 p-6 border border-slate-200">
        <p className="text-sm text-slate-700">This page is a placeholder for the selected navigation item and will be replaced with the full feature later.</p>
      </div>
    </div>
  );
}

export default PlaceholderPage;
