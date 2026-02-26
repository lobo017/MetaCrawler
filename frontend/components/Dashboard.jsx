'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  BarChart3,
  ClipboardList,
  Inbox,
  MessageSquare,
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
  Clock,
  Layers,
  Trash2
} from 'lucide-react';
import AnalyticsChart from './AnalyticsChart';
import JobController from './JobController';
import ChatModal from './ChatModal';
import { FolderPlus, Database } from 'lucide-react';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import WorkspaceChatModal from './WorkspaceChatModal';

const defaultStats = { totalJobs: 0, queuedJobs: 0, doneJobs: 0, failedJobs: 0 };

/* ── animation variants ── */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(defaultStats);
  const [isOnline, setIsOnline] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('--:--');
  const [chats, setChats] = useState([]);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);

  /* ── Health Check Poller ── */
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

  /* ── Data Fetching ── */
  // Replace your existing loadData function with this:
  const loadData = useCallback(async () => {
    const query = `
      query { 
        jobs { id url type status createdAt result } 
        stats { totalJobs queuedJobs doneJobs failedJobs } 
        chats { id title jobIds createdAt history { role text } }
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
      setJobs(body.data.jobs || []);
      setStats(body.data.stats || defaultStats);
      setChats(body.data.chats || []); // <--- Set the chats
    } catch (e) {
      console.error("Failed to fetch jobs", e);
    } finally {
      setIsLoading(false);
      setLastSyncTime(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    // Check if any jobs are still working
    const hasPendingJobs = jobs.some(j => j.status === 'queued' || j.status === 'running');
    if (!hasPendingJobs) return;

    // If yes, ping the database every 3 seconds to see if they finished
    const interval = setInterval(() => {
      loadData();
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, loadData]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleDeleteJob = async (jobId) => {
    // Optimistically update the UI to remove it instantly
    setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));

    // Send the delete request to the backend
    const query = `
      mutation DeleteJob($id: String!) {
        deleteJob(id: $id)
      }
    `;
    try {
      await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { id: jobId } }),
      });
      loadData(); // Refresh stats after deletion
    } catch (e) {
      console.error("Failed to delete job", e);
    }
  };

  const handleDeleteChat = async (chatId) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    const query = `mutation DeleteChat($id: String!) { deleteChat(id: $id) }`;
    await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: chatId } }),
    });
  };

  return (
    <>
      {/* ── Top Navigation Bar ── */}
      <motion.header
        className="border-b border-white/[0.04] bg-[rgba(7,11,20,0.8)] backdrop-blur-xl sticky top-0 z-40"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto max-w-6xl px-6 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">MetaCrawler</span>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-300 ${isOnline
                ? 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15'
                : 'text-rose-400 bg-rose-500/8 border-rose-500/15'
                }`}
              role="status"
              aria-label={`System status: ${isOnline ? 'Online' : 'Offline'}`}
              suppressHydrationWarning
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </motion.header>

      <main id="main-content" className="mx-auto max-w-6xl p-6 md:p-8 space-y-6" role="main">

        {/* ── Top Banner ── */}
        <motion.section
          className="glass-panel p-6 md:p-8 flex flex-col md:flex-row justify-between items-start gap-6"
          aria-label="MetaCrawler platform overview"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <div className="space-y-3">
            <p className="text-blue-400 text-[11px] font-semibold tracking-widest uppercase">Control Plane</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              Operations Dashboard
            </h1>
            <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
              Launch static, dynamic, and AI-powered scraping jobs from a single control plane.
              Monitor your pipeline in real time.
            </p>
          </div>

          {/* Live Status Card */}
          <div
            className="glass-panel p-4 bg-slate-900/30 text-xs min-w-[180px] space-y-2.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-slate-500">
              <Activity className="w-3.5 h-3.5" />
              <span className="font-medium">System Health</span>
            </div>
            <div className={`font-semibold flex items-center gap-2 ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              {isOnline ? 'All systems operational' : 'Gateway unreachable'}
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Layers className="w-3 h-3" />
              <span>Active jobs: <span className="text-white font-mono tabular-nums">{stats.queuedJobs}</span></span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-3 h-3" />
              <span suppressHydrationWarning>Last sync: <span className="text-white font-mono tabular-nums">{lastSyncTime}</span></span>
            </div>
          </div>
        </motion.section>

        {/* ── Main Control Grid ── */}
        <motion.div
          className="grid gap-6 md:grid-cols-5"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* Job Controller */}
          <motion.section
            className="glass-panel p-6 md:col-span-3"
            aria-label="Create new scraping job"
            variants={fadeUp}
          >
            <h2 className="text-base font-semibold mb-6 text-white flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                <Rocket className="w-3.5 h-3.5 text-blue-400" />
              </div>
              Create New Job
            </h2>
            <JobController onCreated={loadData} />
          </motion.section>

          {/* Analytics */}
          <motion.section
            className="glass-panel p-6 md:col-span-2"
            aria-label="System metrics and analytics"
            variants={fadeUp}
          >
            <h2 className="text-base font-semibold mb-6 text-white flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              System Metrics
            </h2>
            <AnalyticsChart stats={stats} />
          </motion.section>
        </motion.div>

        {/* ── Recent Jobs Table ── */}
        {/* ── Workspaces / Multi-Source Chats ── */}
        <motion.section className="glass-panel p-6" variants={fadeUp}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              Active Workspaces
            </h2>
            <button
              onClick={() => setIsCreatingWorkspace(true)}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium shadow-lg shadow-cyan-500/10"
            >
              <FolderPlus className="w-3.5 h-3.5" /> New Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chats.length === 0 ? (
              <p className="text-sm text-slate-500 italic col-span-full">No workspaces created yet. Group multiple scrapes together to chat with them all at once!</p>
            ) : (
              chats.map(chat => (
                <div key={chat.id} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group relative">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm text-slate-100">{chat.title}</h3>
                    <button onClick={() => handleDeleteChat(chat.id)} className="text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{chat.jobIds.length} connected sources</p>

                  <button
                    onClick={() => setSelectedChat(chat)}
                    className="w-full py-2 bg-white/[0.05] hover:bg-cyan-500/20 hover:text-cyan-400 border border-white/[0.05] hover:border-cyan-500/30 rounded-lg text-xs font-medium transition-all flex justify-center items-center gap-2 text-slate-300"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Open Workspace
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.section>
        <motion.section
          className="glass-panel p-6"
          aria-label="Recent jobs"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-slate-500/10 border border-slate-500/15 flex items-center justify-center">
                <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
              </div>
              Recent Jobs
            </h2>
            <button
              onClick={handleRefresh}
              aria-label="Refresh job list"
              className="text-xs bg-white/[0.03] text-slate-400 px-3.5 py-2 rounded-lg hover:bg-white/[0.06] hover:text-slate-300
                         transition-all duration-300 border border-white/[0.06] hover:border-white/[0.1]
                         active:scale-95 flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading jobs">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-12 w-full rounded-lg" />
              ))}
              <span className="sr-only">Loading job data...</span>
            </div>
          ) : (
            <div className="overflow-hidden" role="region" aria-label="Jobs table" tabIndex={0}>
              <table className="min-w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-[10px] tracking-wider text-left">URL</th>
                    <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-[10px] tracking-wider text-left">Type</th>
                    <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-[10px] tracking-wider text-left">Status</th>
                    <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-[10px] tracking-wider text-left">Created</th>
                    <th scope="col" className="py-3 px-4 font-medium text-slate-500 uppercase text-[10px] tracking-wider text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  <AnimatePresence>
                    {jobs.map((job) => (
                      <motion.tr
                        key={job.id}
                        className="hover:bg-white/[0.02] transition-colors duration-300"
                        variants={fadeIn}
                        initial="hidden"
                        animate="visible"
                        exit={{
                          opacity: 0,
                          height: 0,
                          paddingTop: 0,
                          paddingBottom: 0,
                          transition: {
                            opacity: { duration: 0.2, ease: 'easeOut' },
                            height: { duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.1 },
                            paddingTop: { duration: 0.3, ease: 'easeOut', delay: 0.1 },
                            paddingBottom: { duration: 0.3, ease: 'easeOut', delay: 0.1 },
                          },
                        }}
                        style={{ overflow: 'hidden' }}
                        layout
                        transition={{ layout: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }}
                      >
                        <td className="py-3.5 px-4 max-w-xs truncate font-mono text-sm text-slate-300" title={job.url}>
                          {job.url}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="bg-white/[0.04] text-slate-300 px-2.5 py-1 rounded-md text-xs border border-white/[0.06] font-medium">
                            {job.type}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`badge badge-${job.status}`} role="status">
                            {job.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          <time dateTime={job.createdAt}>
                            {new Date(job.createdAt).toLocaleString()}
                          </time>
                        </td>

                        <td className="py-3.5 px-4 flex items-center gap-2">
                          {job.status === 'done' && (
                            <motion.button
                              onClick={() => setSelectedJob(job)}
                              aria-label={`Chat about scraped data from ${job.url}`}
                              className="text-xs bg-cyan-500/8 text-cyan-400 border border-cyan-500/15 px-3.5 py-1.5 rounded-full
                                         hover:bg-cyan-500/15 transition-all duration-300 flex items-center gap-1.5 group"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <MessageSquare className="w-3 h-3 group-hover:translate-x-0 transition-transform duration-200" />
                              Chat
                            </motion.button>
                          )}
                          <motion.button
                            onClick={() => handleDeleteJob(job.id)}
                            aria-label={`Delete job ${job.url}`}
                            className="text-xs bg-rose-500/8 text-rose-400 border border-rose-500/15 w-7 h-7 rounded-full flex items-center justify-center hover:bg-rose-500/15 transition-all duration-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>

                  {!jobs.length && (
                    <tr>
                      <td colSpan="5" className="py-16 text-center text-slate-600">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                            <Inbox className="w-5 h-5 text-slate-600" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-500">No jobs yet</p>
                            <p className="text-xs text-slate-600">Create a new scraping job from the panel above.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        {/* ── Q/A Bot Modal ── */}
        <AnimatePresence>
          {selectedJob && (
            <ChatModal
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {/* Legacy Single-Job Modal */}
          {selectedJob && <ChatModal job={selectedJob} onClose={() => setSelectedJob(null)} />}

          {/* New Modals */}
          {isCreatingWorkspace && (
            <CreateWorkspaceModal jobs={jobs} onClose={() => setIsCreatingWorkspace(false)} onCreated={loadData} />
          )}
          {selectedChat && (
            <WorkspaceChatModal chat={selectedChat} allJobs={jobs} onClose={() => setSelectedChat(null)} onRefresh={loadData} />
          )}
        </AnimatePresence>
      </main>
    </>
  );
}