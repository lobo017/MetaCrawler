'use client';

import { useCallback, useEffect, useState } from 'react';
import AnalyticsChart from './AnalyticsChart';
import JobController from './JobController';
import ChatModal from './ChatModal';

const defaultStats = { totalJobs: 0, queuedJobs: 0, doneJobs: 0, failedJobs: 0 };

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(defaultStats);
  const [isOnline, setIsOnline] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Health Check Poller
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:4000/health');
        const data = await res.json();
        setIsOnline(data.status === 'ok');
      } catch {
        setIsOnline(false);
      }
    };
    checkHealth();
    const id = setInterval(checkHealth, 10000);
    return () => clearInterval(id);
  }, []);

  // Data Fetching
  const loadData = useCallback(async () => {
    const query = `
      query { 
        jobs { id url type status createdAt result } 
        stats { totalJobs queuedJobs doneJobs failedJobs } 
      }
    `;

    try {
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
    } catch (e) {
      console.error("Failed to fetch jobs", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <main id="main-content" className="mx-auto max-w-6xl p-6 md:p-8 space-y-6" role="main">

      {/* ── Top Banner ── */}
      <section
        className="glass-panel p-6 md:p-8 flex flex-col md:flex-row justify-between items-start gap-4 animate-fade-in-up"
        aria-label="MetaCrawler platform overview"
      >
        <div>
          <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-2">MetaCrawler Platform</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-white">Operations Dashboard</h1>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Launch static, dynamic, and AI-powered jobs from one control plane and monitor the pipeline in real time.
          </p>
        </div>

        {/* Live Status */}
        <div
          className="text-right glass-panel p-4 bg-slate-900/40 text-xs min-w-[160px]"
          role="status"
          aria-live="polite"
          aria-label={`System status: ${isOnline ? 'Online' : 'Offline'}`}
        >
          <p className="text-slate-500 mb-1">Live status</p>
          <p className={`font-bold mb-2 flex items-center justify-end gap-1.5 ${isOnline ? 'text-emerald-400' : 'text-rose-500'}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} aria-hidden="true" />
            {isOnline ? 'Online' : 'Offline'}
          </p>
          <p className="text-slate-300">Active jobs: <span className="text-white font-mono">{stats.queuedJobs}</span></p>
          <p className="text-slate-300">Last sync: <span className="text-white font-mono">{new Date().toLocaleTimeString()}</span></p>
        </div>
      </section>

      {/* ── Main Control Grid ── */}
      <div className="grid gap-6 md:grid-cols-5 stagger-children">
        {/* Job Controller */}
        <section
          className="glass-panel p-6 md:col-span-3 animate-fade-in-up"
          aria-label="Create new scraping job"
        >
          <h2 className="text-lg font-semibold mb-6 text-white flex items-center gap-2">
            <span aria-hidden="true">🚀</span> Create New Job
          </h2>
          <JobController onCreated={loadData} />
        </section>

        {/* Analytics */}
        <section
          className="glass-panel p-6 md:col-span-2 animate-fade-in-up"
          aria-label="System metrics and analytics"
        >
          <h2 className="text-lg font-semibold mb-6 text-white flex items-center gap-2">
            <span aria-hidden="true">📊</span> System Metrics
          </h2>
          <AnalyticsChart stats={stats} />
        </section>
      </div>

      {/* ── Recent Jobs Table ── */}
      <section className="glass-panel p-6 animate-fade-in-up" aria-label="Recent jobs">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span aria-hidden="true">📋</span> Recent Jobs
          </h2>
          <button
            onClick={loadData}
            aria-label="Refresh job list"
            className="text-xs bg-slate-800 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700 
                       transition-all duration-200 border border-slate-700 hover:border-slate-600
                       active:scale-95 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {isLoading ? (
          /* Skeleton Loading State */
          <div className="space-y-3" role="status" aria-label="Loading jobs">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-12 w-full rounded-lg" />
            ))}
            <span className="sr-only">Loading job data...</span>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Jobs table" tabIndex={0}>
            <table className="min-w-full text-sm text-slate-400" role="table">
              <thead>
                <tr className="border-b border-slate-700/50 text-left">
                  <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">URL</th>
                  <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Type</th>
                  <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Status</th>
                  <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Created</th>
                  <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {jobs.map((job, index) => (
                  <tr
                    key={job.id}
                    className="hover:bg-white/5 transition-colors duration-200 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="py-3 px-4 max-w-xs truncate font-mono text-slate-300" title={job.url}>
                      {job.url}
                    </td>

                    <td className="py-3 px-4">
                      <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md text-xs border border-slate-700 font-medium">
                        {job.type}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`badge badge-${job.status}`} role="status">
                        {job.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs">
                      <time dateTime={job.createdAt}>
                        {new Date(job.createdAt).toLocaleString()}
                      </time>
                    </td>

                    <td className="py-3 px-4">
                      {job.status === 'done' && (
                        <button
                          onClick={() => setSelectedJob(job)}
                          aria-label={`Chat about scraped data from ${job.url}`}
                          className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3.5 py-1.5 rounded-full 
                                     hover:bg-cyan-500/20 transition-all duration-200 flex items-center gap-1.5 group
                                     active:scale-95 hover:shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                        >
                          <span className="group-hover:scale-110 transition-transform duration-200" aria-hidden="true">💬</span> Chat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!jobs.length && (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-600">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl" aria-hidden="true">📭</span>
                        <p>No jobs yet. Create one from the panel above.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Q/A Bot Modal ── */}
      {selectedJob && (
        <ChatModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </main>
  );
}