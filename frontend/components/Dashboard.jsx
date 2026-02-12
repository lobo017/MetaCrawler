'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AnalyticsChart from './AnalyticsChart';
import JobController from './JobController';

const defaultStats = { totalJobs: 0, queuedJobs: 0, doneJobs: 0, failedJobs: 0 };

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(defaultStats);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  const loadData = useCallback(async () => {
    const query = `query { jobs { id url type status createdAt result } stats { totalJobs queuedJobs doneJobs failedJobs } }`;
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        cache: 'no-store',
      });

      const body = await response.json();
      if (!body?.data) return;
      setJobs(body.data.jobs || []);
      setStats(body.data.stats || defaultStats);
      setLastSync(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activeJobs = useMemo(() => jobs.filter((job) => job.status === 'queued').length, [jobs]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="card rounded-2xl p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">MetaCrawler Platform</p>
            <h1 className="mt-1 text-3xl font-bold text-white md:text-4xl">Operations Dashboard</h1>
            <p className="mt-2 max-w-3xl text-slate-300">
              Launch static, dynamic, and AI-powered jobs from one control plane and monitor the pipeline in real time.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm">
            <p className="text-slate-400">Live status</p>
            <p className="mt-1 font-semibold text-emerald-400">{loading ? 'Syncing…' : 'Online'}</p>
            <p className="mt-2 text-slate-400">Active jobs: <span className="font-semibold text-white">{activeJobs}</span></p>
            <p className="text-slate-400">Last sync: <span className="text-slate-200">{lastSync ? lastSync.toLocaleTimeString() : '—'}</span></p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="card rounded-2xl p-5 lg:col-span-3">
          <h2 className="mb-4 text-xl font-semibold text-white">Create New Job</h2>
          <JobController onCreated={loadData} />
        </div>

        <div className="card rounded-2xl p-5 lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold text-white">System Metrics</h2>
          <AnalyticsChart stats={stats} />
        </div>
      </section>

      <section className="card rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent Jobs</h2>
          <button
            onClick={loadData}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-800 bg-slate-950/35 text-slate-200">
                  <td className="max-w-[320px] truncate px-4 py-3" title={job.url}>{job.url}</td>
                  <td className="px-4 py-3 uppercase tracking-wide text-slate-300">{job.type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!jobs.length && (
            <div className="px-4 py-10 text-center text-slate-400">
              No jobs yet. Create one from the panel above.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function badgeClass(status) {
  if (status === 'done') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
  if (status === 'failed') return 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
  return 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
}
