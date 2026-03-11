'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, CheckCircle2 } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function AnalyticsChart({ stats }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const successRate = stats.totalJobs > 0
    ? Math.round((stats.doneJobs / stats.totalJobs) * 100)
    : 0;

  return (
    <motion.div
      className="space-y-6"
      role="region"
      aria-label="Job statistics"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* Top Cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total Jobs"
          value={stats.totalJobs}
          icon={Package}
          accentColor="blue"
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          icon={CheckCircle2}
          accentColor="emerald"
        />
      </div>

      {/* Progress Bars */}
      <div className="space-y-5 pt-2" role="list" aria-label="Job status breakdown">
        <MetricBar
          label="Queued"
          value={stats.queuedJobs}
          total={stats.totalJobs}
          color="bg-amber-400"
          animated={mounted}
        />
        <MetricBar
          label="Done"
          value={stats.doneJobs}
          total={stats.totalJobs}
          color="bg-emerald-500"
          animated={mounted}
        />
        <MetricBar
          label="Failed"
          value={stats.failedJobs}
          total={stats.totalJobs}
          color="bg-rose-500"
          animated={mounted}
        />
      </div>
    </motion.div>
  );
}

const accentMap = {
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/15', text: 'text-blue-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/15', text: 'text-emerald-400' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/15', text: 'text-cyan-400' },
};

function StatCard({ label, value, icon: Icon, accentColor = 'blue' }) {
  const accent = accentMap[accentColor] || accentMap.blue;

  return (
    <motion.div
      className="glass-panel bg-black/20 p-4 border-white/[0.04] flex flex-col justify-between h-24"
      variants={fadeUp}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${accent.text}`} />
        </div>
      </div>
      <p
        className="text-3xl font-bold tracking-tight text-white tabular-nums"
        aria-label={`${label}: ${value}`}
      >
        {value}
      </p>
    </motion.div>
  );
}

function MetricBar({ label, value, total, color, animated }) {
  const width = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className="space-y-2" role="listitem">
      <div className="flex justify-between text-[11px] font-medium text-slate-400">
        <span>{label}</span>
        <span className="text-slate-200 font-mono tabular-nums">{value}</span>
      </div>
      <div
        className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden"
        role="progressbar"
        aria-label={`${label}: ${value} of ${total}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: '0%' }}
          animate={{ width: animated ? `${width}%` : '0%' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </div>
    </div>
  );
}