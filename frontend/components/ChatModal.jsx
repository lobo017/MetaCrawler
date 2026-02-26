'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send } from 'lucide-react';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2, delay: 0.05 } },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
};

const messageVariant = {
  hidden: { opacity: 0, y: 6, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export default function ChatModal({ job, onClose }) {
  const isSiteMode = job.type.startsWith('site');

  const [messages, setMessages] = useState([
    { role: 'bot', text: `I have analyzed ${isSiteMode ? 'the site corpus for' : 'the content from'} ${job.url}. Ask me anything.` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  /* ── Load saved chat history ── */
  useEffect(() => {
    const loadHistory = async () => {
      const query = `
        query GetHistory($jobId: String!) {
          getChatHistory(jobId: $jobId) {
            role
            text
          }
        }
      `;
      try {
        const res = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { jobId: job.id } }),
        });
        const body = await res.json();
        const history = body.data?.getChatHistory;

        if (history && history.length > 0) {
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };
    loadHistory();
  }, [job.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Re-focus input after every message so the user can keep typing
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [messages, loading]);

  useEffect(() => {
    // Delay initial focus so it fires after the modal open animation completes
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let query;
      let variables;

      if (isSiteMode) {
        query = `
          query AskSite($jobId: String, $url: String!, $question: String!, $topK: Int) {
            askSite(jobId: $jobId, url: $url, question: $question, topK: $topK) {
              answer
            }
          }
        `;
        variables = { jobId: job.id, url: job.url, question: userMsg.text, topK: 3 };
      } else {
        query = `
          mutation Ask($jobId: String!, $question: String!) {
            askQuestion(jobId: $jobId, question: $question) {
              answer
            }
          }
        `;
        variables = { jobId: job.id, question: userMsg.text };
      }

      const res = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });

      const body = await res.json();
      if (body.errors?.length) {
        setMessages((prev) => [...prev, { role: 'bot', text: body.errors[0].message || "Sorry, I couldn't process that." }]);
        return;
      }

      const answer = isSiteMode
        ? (body.data?.askSite?.answer || "Sorry, I couldn't find an answer in the site corpus.")
        : (body.data?.askQuestion?.answer || "Sorry, I couldn't process that.");

      setMessages((prev) => [...prev, { role: 'bot', text: answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'bot', text: 'Error connecting to QA brain.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="glass-panel w-full max-w-lg flex flex-col overflow-hidden h-[600px]"
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Data Q&A</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[280px]" title={job.url}>{job.url}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-500 hover:text-slate-300 w-8 h-8 flex items-center justify-center rounded-lg
                       hover:bg-white/[0.05] transition-all duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                variants={messageVariant}
                initial="hidden"
                animate="visible"
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                    : 'bg-white/[0.04] text-slate-300 border border-white/[0.06] rounded-2xl rounded-bl-md'
                    }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              className="flex justify-start"
              variants={messageVariant}
              initial="hidden"
              animate="visible"
            >
              <div className="bg-white/[0.04] px-4 py-3 rounded-2xl rounded-bl-md border border-white/[0.06]">
                <div className="flex space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-white/[0.06]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about this data..."
              className="input-dark flex-1 text-sm"
              disabled={loading}
              autoComplete="off"
            />
            <motion.button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl font-medium
                         transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                         flex items-center justify-center"
              whileHover={!loading && input.trim() ? { scale: 1.03 } : {}}
              whileTap={!loading && input.trim() ? { scale: 0.97 } : {}}
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}