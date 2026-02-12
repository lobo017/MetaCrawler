'use client';

export default function AnalyticsChart({ stats }) {
  const rows = [
    { key: 'Queued', value: stats.queuedJobs },
    { key: 'Done', value: stats.doneJobs },
    { key: 'Failed', value: stats.failedJobs },
  ];

  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-3">
      <h2 className="text-4xl font-semibold text-slate-200">System Metrics</h2>
      <p className="text-3xl text-slate-700">Total jobs: {stats.totalJobs}</p>

      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-center justify-between text-2xl text-slate-300">
            <span>{row.key}</span>
            <span>{row.value}</span>
          </div>
          <div className="h-3 rounded bg-slate-200">
            <div className="h-full rounded bg-slate-300" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
