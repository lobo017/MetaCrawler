'use client';

import { useEffect, useState } from 'react';

export default function AnalyticsChart({ stats }) {
  const [mounted, setMounted] = useState(false);

  // Trigger bar animations after mount
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const successRate = stats.totalJobs > 0
    ? Math.round((stats.doneJobs / stats.totalJobs) * 100)
    : 0;

  return (
    <div className="space-y-6" role="region" aria-label="Job statistics">
      {/* Top Cards */}
      <div className="grid grid-cols-2 gap-4 stagger-children">
        <StatCard label="Total Jobs" value={stats.totalJobs} icon="📦" />
        <StatCard label="Success Rate" value={`${successRate}%`} icon="✅" />
      </div>

      {/* Progress Bars */}
      <div className="space-y-5 pt-2" role="list" aria-label="Job status breakdown">
        <MetricBar
          label="Queued"
          value={stats.queuedJobs}
          total={stats.totalJobs}
          color="bg-amber-400"
          track="bg-slate-800"
          animated={mounted}
        />
        <MetricBar
          label="Completed"
          value={stats.doneJobs}
          total={stats.totalJobs}
          color="bg-emerald-500"
          track="bg-slate-800"
          animated={mounted}
        />
        <MetricBar
          label="Failed"
          value={stats.failedJobs}
          total={stats.totalJobs}
          color="bg-rose-500"
          track="bg-slate-800"
          animated={mounted}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="glass-panel bg-black/20 p-4 border-white/5 flex flex-col justify-between h-24 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
        <span className="text-lg" aria-hidden="true">{icon}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight text-white" aria-label={`${label}: ${value}`}>
        {value}
      </p>
    </div>
  );
}

function MetricBar({ label, value, total, color, track, animated }) {
  const width = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className="space-y-2" role="listitem">
      <div className="flex justify-between text-[11px] font-medium text-slate-400">
        <span>{label}</span>
        <span className="text-slate-200 font-mono">{value}</span>
      </div>
      <div
        className={`h-2 w-full ${track} rounded-full overflow-hidden`}
        role="progressbar"
        aria-label={`${label}: ${value} of ${total}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: animated ? `${width}%` : '0%' }}
        />
      </div>
    </div>
  );
}