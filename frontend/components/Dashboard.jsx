'use client';

import { useCallback, useEffect, useState } from 'react';
import AnalyticsChart from './AnalyticsChart';
import JobController from './JobController';

const defaultStats = { totalJobs: 0, queuedJobs: 0, doneJobs: 0, failedJobs: 0 };

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(defaultStats);

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
    } catch {
      // keep previous values
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <main className="app-shell">
      <h1 className="mb-8 text-6xl font-bold text-slate-100">MetaCrawler Dashboard</h1>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="panel p-6">
          <JobController onCreated={loadData} />
        </div>
        <div className="panel p-6">
          <AnalyticsChart stats={stats} />
        </div>
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="text-5xl font-semibold text-slate-200">Recent Jobs</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xl">
            <thead className="text-slate-300">
              <tr className="border-b border-slate-300">
                <th className="px-2 py-3">URL</th>
                <th className="px-2 py-3">Type</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-200">
                  <td className="max-w-[360px] truncate px-2 py-3" title={job.url}>{job.url}</td>
                  <td className="px-2 py-3">{job.type}</td>
                  <td className="px-2 py-3">{job.status}</td>
                  <td className="px-2 py-3">{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!jobs.length && <p className="px-2 py-5 text-3xl text-slate-600">No jobs yet.</p>}
        </div>
      </section>
    </main>
  );
}
