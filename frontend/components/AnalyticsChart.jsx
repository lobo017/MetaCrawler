'use client';

export default function AnalyticsChart({ stats }) {
  const data = [
    { label: 'Queued', value: stats.queuedJobs, color: 'bg-amber-400' },
    { label: 'Done', value: stats.doneJobs, color: 'bg-emerald-500' },
    { label: 'Failed', value: stats.failedJobs, color: 'bg-rose-500' },
  ];

  const max = Math.max(1, ...data.map((entry) => entry.value));

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Total jobs: {stats.totalJobs}</p>
      {data.map((entry) => (
        <div key={entry.label} className="space-y-1">
          <div className="flex justify-between text-sm"><span>{entry.label}</span><span>{entry.value}</span></div>
          <div className="h-3 rounded bg-gray-100"><div className={`h-full rounded ${entry.color}`} style={{ width: `${(entry.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
