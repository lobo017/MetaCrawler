'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, FolderPlus, Loader2 } from 'lucide-react';

export default function CreateWorkspaceModal({ jobs, onClose, onCreated }) {
    const [title, setTitle] = useState('');
    const [selectedJobs, setSelectedJobs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Only allow jobs that have successfully completed
    const completedJobs = jobs.filter(j => j.status === 'done');

    const toggleJob = (jobId) => {
        setSelectedJobs(prev =>
            prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || selectedJobs.length === 0) return;

        setLoading(true);
        const query = `
      mutation CreateChat($title: String!, $jobIds: [String!]!) {
        createChat(title: $title, jobIds: $jobIds) {
          id
        }
      }
    `;

        try {
            await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { title, jobIds: selectedJobs } }),
            });
            onCreated();
            onClose();
        } catch (err) {
            console.error("Failed to create workspace", err);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
                className="glass-panel w-full max-w-lg overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="p-4 border-b border-white/[0.06] flex justify-between items-center bg-white/[0.02]">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <FolderPlus className="w-4 h-4 text-cyan-400" /> Create Workspace
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05]">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Workspace Name</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g., Competitor Analysis"
                            className="input-dark w-full text-sm"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                            Select Data Sources ({selectedJobs.length} selected)
                        </label>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                            {completedJobs.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No completed jobs available to add.</p>
                            ) : (
                                completedJobs.map(job => (
                                    <label key={job.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${selectedJobs.includes(job.id) ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}>
                                        <input
                                            type="checkbox"
                                            className="accent-cyan-500 w-4 h-4 rounded bg-slate-800 border-slate-600"
                                            checked={selectedJobs.includes(job.id)}
                                            onChange={() => toggleJob(job.id)}
                                        />
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm text-slate-200 truncate" title={job.url}>{job.url}</p>
                                            <p className="text-[10px] text-slate-500 uppercase mt-0.5">{job.type}</p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button
                            type="submit"
                            disabled={loading || !title.trim() || selectedJobs.length === 0}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Workspace'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}