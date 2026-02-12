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
  const [selectedJob, setSelectedJob] = useState(null); // State for the Q/A Modal

  // 1. Health Check Poller (Checks if API Gateway is reachable)
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
    const id = setInterval(checkHealth, 10000); // Check every 10 seconds
    return () => clearInterval(id);
  }, []);

  // 2. Data Fetching (Jobs & Stats)
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
    }
  }, []);

  // Poll for data updates every 3 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <main className="mx-auto max-w-6xl p-8 space-y-6">
      
      {/* --- Top Banner Section --- */}
      <section className="glass-panel p-8 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-2">MetaCrawler Platform</p>
          <h1 className="text-4xl font-bold mb-3 text-white">Operations Dashboard</h1>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Launch static, dynamic, and AI-powered jobs from one control plane and monitor the pipeline in real time.
          </p>
        </div>
        
        {/* Live Status Box */}
        <div className="text-right glass-panel p-4 bg-slate-900/40 text-xs min-w-[140px]">
          <p className="text-slate-500 mb-1">Live status</p>
          <p className={`font-bold mb-2 ${isOnline ? 'text-emerald-400' : 'text-rose-500'}`}>
            ● {isOnline ? 'Online' : 'Offline'}
          </p>
          <p className="text-slate-300">Active jobs: <span className="text-white font-mono">{stats.queuedJobs}</span></p>
          <p className="text-slate-300">Last sync: <span className="text-white font-mono">{new Date().toLocaleTimeString()}</span></p>
        </div>
      </section>

      {/* --- Main Control Grid --- */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* Left Column: Job Controller */}
        <section className="glass-panel p-6 md:col-span-3">
          <h2 className="text-lg font-semibold mb-6 text-white">Create New Job</h2>
          <JobController onCreated={loadData} />
        </section>
        
        {/* Right Column: Analytics */}
        <section className="glass-panel p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-6 text-white">System Metrics</h2>
          <AnalyticsChart stats={stats} />
        </section>
      </div>

      {/* --- Recent Jobs Table --- */}
      <section className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">Recent Jobs</h2>
          <button 
            onClick={loadData} 
            className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded hover:bg-slate-700 transition border border-slate-700"
          >
            Refresh
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-400">
            <thead>
              <tr className="border-b border-slate-700/50 text-left">
                <th className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">URL</th>
                <th className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Type</th>
                <th className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Status</th>
                <th className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Created</th>
                <th className="py-3 px-4 font-medium text-slate-500 uppercase text-xs tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/5 transition-colors">
                  {/* URL */}
                  <td className="py-3 px-4 max-w-xs truncate font-mono text-slate-300" title={job.url}>
                    {job.url}
                  </td>
                  
                  {/* Type */}
                  <td className="py-3 px-4">
                    <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs border border-slate-700">
                      {job.type}
                    </span>
                  </td>
                  
                  {/* Status Badge */}
                  <td className="py-3 px-4">
                    <span className={`badge badge-${job.status}`}>
                      {job.status}
                    </span>
                  </td>
                  
                  {/* Date */}
                  <td className="py-3 px-4 text-xs">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>

                  {/* Actions (Chat Button) */}
                  <td className="py-3 px-4">
                    {job.status === 'done' && (
                      <button 
                        onClick={() => setSelectedJob(job)}
                        className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full hover:bg-cyan-500/20 transition flex items-center gap-1 group"
                      >
                        <span className="group-hover:scale-110 transition-transform">💬</span> Chat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              
              {!jobs.length && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-600">
                    No jobs yet. Create one from the panel above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- Q/A Bot Modal --- */}
      {selectedJob && (
        <ChatModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
        />
      )}
    </main>
  );
}