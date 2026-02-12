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
    const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });

    const body = await response.json();
    if (!body?.data) return;
    setJobs(body.data.jobs);
    setStats(body.data.stats);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <h1 className="text-3xl font-bold">MetaCrawler Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded border border-gray-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-semibold">Start New Job</h2><JobController onCreated={loadData} /></section>
        <section className="rounded border border-gray-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-semibold">System Metrics</h2><AnalyticsChart stats={stats} /></section>
      </div>
      <section className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Recent Jobs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">URL</th><th className="py-2">Type</th><th className="py-2">Status</th><th className="py-2">Created</th></tr></thead>
            <tbody>{jobs.map((job) => (<tr key={job.id} className="border-b"><td className="max-w-xs truncate py-2">{job.url}</td><td className="py-2">{job.type}</td><td className="py-2">{job.status}</td><td className="py-2">{new Date(job.createdAt).toLocaleString()}</td></tr>))}</tbody>
          </table>
          {!jobs.length && <p className="py-4 text-gray-500">No jobs yet.</p>}
        </div>
      </section>
    </main>
  );
}
