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
      <p className="text-[32px] font-semibold text-slate-200">System Metrics</p>
      <p className="text-[34px] text-slate-700">Total jobs: {stats.totalJobs}</p>

      {rows.map((row) => (
        <div key={row.key} className="space-y-1.5">
          <div className="flex items-center justify-between text-[30px] text-slate-200">
            <span>{row.key}</span>
            <span>{row.value}</span>
          </div>
          <div className="h-4 rounded-md bg-slate-200">
            <div
              className="h-full rounded-md bg-slate-300"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
