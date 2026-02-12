'use client';

export default function AnalyticsChart({ stats }) {
  const successRate = stats.totalJobs > 0 
    ? Math.round((stats.doneJobs / stats.totalJobs) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel bg-black/20 p-4 border-white/5 flex flex-col justify-between h-24">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Jobs</p>
          <p className="text-3xl font-bold tracking-tight text-white">{stats.totalJobs}</p>
        </div>
        <div className="glass-panel bg-black/20 p-4 border-white/5 flex flex-col justify-between h-24">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Success Rate</p>
          <p className="text-3xl font-bold tracking-tight text-white">{successRate}%</p>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-5 pt-2">
        <MetricBar 
          label="Queued" 
          value={stats.queuedJobs} 
          total={stats.totalJobs} 
          color="bg-amber-400" 
          track="bg-slate-800"
        />
        <MetricBar 
          label="Completed" 
          value={stats.doneJobs} 
          total={stats.totalJobs} 
          color="bg-emerald-500" 
          track="bg-slate-800"
        />
        <MetricBar 
          label="Failed" 
          value={stats.failedJobs} 
          total={stats.totalJobs} 
          color="bg-rose-500" 
          track="bg-slate-800"
        />
      </div>
    </div>
  );
}

function MetricBar({ label, value, total, color, track }) {
  // Prevent division by zero
  const width = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] font-medium text-slate-400">
        <span>{label}</span>
        <span className="text-slate-200">{value}</span>
      </div>
      <div className={`h-1.5 w-full ${track} rounded-full overflow-hidden`}>
        <div 
          className={`h-full ${color} transition-all duration-700 ease-out`} 
          style={{ width: `${width}%` }} 
        />
      </div>
    </div>
  );
}