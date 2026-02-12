'use client';

const palette = {
  queued: 'from-amber-400 to-yellow-500',
  done: 'from-emerald-400 to-green-500',
  failed: 'from-rose-400 to-red-500',
};

export default function AnalyticsChart({ stats }) {
  const data = [
    { key: 'queued', label: 'Queued', value: stats.queuedJobs },
    { key: 'done', label: 'Completed', value: stats.doneJobs },
    { key: 'failed', label: 'Failed', value: stats.failedJobs },
  ];

  const max = Math.max(1, ...data.map((entry) => entry.value));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard title="Total Jobs" value={stats.totalJobs} />
        <MetricCard title="Success Rate" value={`${stats.totalJobs ? Math.round((stats.doneJobs / stats.totalJobs) * 100) : 0}%`} />
      </div>

      <div className="space-y-4">
        {data.map((entry) => (
          <div key={entry.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span>{entry.label}</span>
              <span className="font-semibold">{entry.value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${palette[entry.key]}`}
                style={{ width: `${(entry.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ title, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
