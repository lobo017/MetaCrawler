'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Plus } from 'lucide-react';

export default function WorkspaceChatModal({ chat, allJobs, onClose, onRefresh }) {
    // Use the history array we fetched from the dashboard
    const [messages, setMessages] = useState(
        chat.history.length > 0
            ? chat.history
            : [{ role: 'bot', text: `Welcome to ${chat.title}. I am connected to ${chat.jobIds.length} sources. Ask me anything!` }]
    );
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAddingSources, setIsAddingSources] = useState(false);

    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        const query = `
      mutation AskChat($chatId: String!, $question: String!) {
        askChat(chatId: $chatId, question: $question) {
          answer
        }
      }
    `;

        try {
            const res = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { chatId: chat.id, question: userMsg.text } }),
            });
            const body = await res.json();
            const answer = body.data?.askChat?.answer || "Sorry, I couldn't process that across these sources.";
            setMessages(prev => [...prev, { role: 'bot', text: answer }]);
            onRefresh(); // Refresh dashboard to update history preview
        } catch (err) {
            setMessages(prev => [...prev, { role: 'bot', text: 'Error connecting to the Hybrid QA engine.' }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleAddSources = async (selectedJobIds) => {
        setLoading(true);
        const query = `
      mutation AddJobs($chatId: String!, $jobIds: [String!]!) {
        addJobsToChat(chatId: $chatId, jobIds: $jobIds) { id }
      }
    `;
        await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { chatId: chat.id, jobIds: selectedJobIds } }),
        });
        setIsAddingSources(false);
        setLoading(false);
        onRefresh(); // Refresh dashboard to show new source count
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div className="glass-panel w-full max-w-2xl flex flex-col overflow-hidden h-[700px]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

                {/* Header */}
                <div className="p-4 border-b border-white/[0.06] flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">{chat.title}</h3>
                            <p className="text-[11px] text-slate-400">{chat.jobIds.length} connected sources</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIsAddingSources(!isAddingSources)} className="text-xs bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-white/[0.05]">
                            <Plus className="w-3.5 h-3.5" /> Add Sources
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05]">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {isAddingSources ? (
                    <AddSourcesView chat={chat} allJobs={allJobs} onSave={handleAddSources} onCancel={() => setIsAddingSources(false)} loading={loading} />
                ) : (
                    <>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white/[0.04] text-slate-200 border border-white/[0.06] rounded-2xl rounded-tl-sm'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {loading && <div className="text-slate-500 text-xs flex gap-1 items-center animate-pulse"><Bot className="w-3 h-3" /> AI is thinking...</div>}
                            <div ref={scrollRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSend} className="p-4 border-t border-white/[0.06] bg-white/[0.01]">
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={`Search across ${chat.jobIds.length} sources...`}
                                    className="input-dark flex-1 text-sm"
                                    disabled={loading}
                                />
                                <button type="submit" disabled={loading || !input.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </motion.div>
        </div>
    );
}

// Sub-component for adding sources to an existing chat
function AddSourcesView({ chat, allJobs, onSave, onCancel, loading }) {
    const availableJobs = allJobs.filter(j => j.status === 'done' && !chat.jobIds.includes(j.id));
    const [selected, setSelected] = useState([]);

    const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    return (
        <div className="flex-1 flex flex-col p-6">
            <h4 className="text-sm font-semibold mb-4 text-white">Select new sources to attach</h4>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2 mb-4">
                {availableJobs.length === 0 ? <p className="text-slate-500 text-sm">No new completed jobs available.</p> : availableJobs.map(job => (
                    <label key={job.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${selected.includes(job.id) ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        <input type="checkbox" className="accent-cyan-500 w-4 h-4 rounded" checked={selected.includes(job.id)} onChange={() => toggle(job.id)} />
                        <span className="text-sm truncate flex-1 text-slate-200">{job.url}</span>
                    </label>
                ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-white/[0.06] pt-4">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
                <button onClick={() => onSave(selected)} disabled={loading || selected.length === 0} className="bg-cyan-600 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                    Attach Sources
                </button>
            </div>
        </div>
    );
}