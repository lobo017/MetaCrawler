'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function ChatModal({ job, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: `I have analyzed content from ${job.url}. Ask me anything!` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape key to close & focus trap
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    // Focus trap: keep Tab within the modal
    if (e.key === 'Tab') {
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on backdrop click
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
      const query = `
        mutation Ask($jobId: String!, $question: String!) {
          askQuestion(jobId: $jobId, question: $question) {
            answer
          }
        }
      `;

      const res = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { jobId: job.id, question: userMsg.text } }),
      });

      const body = await res.json();
      const answer = body.data?.askQuestion?.answer || "Sorry, I couldn't process that.";

      setMessages((prev) => [...prev, { role: 'bot', text: answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'bot', text: 'Error connecting to QA brain.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Data Q&A Bot for ${job.url}`}
    >
      <div
        ref={modalRef}
        className="glass-panel w-full max-w-lg flex flex-col overflow-hidden h-[600px] shadow-2xl animate-fade-in-up"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <span aria-hidden="true">🤖</span> Data Q&A Bot
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[300px]" title={job.url}>{job.url}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat modal"
            className="text-slate-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center 
                       rounded-lg hover:bg-white/10 active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* Chat Area */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className={`max-w-[80%] p-3 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-900/20'
                  : 'bg-slate-800 text-slate-200 border border-white/5 rounded-bl-none shadow-lg shadow-black/20'
                }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in" role="status" aria-label="Thinking">
              <div className="bg-slate-800 p-3 rounded-xl rounded-bl-none border border-white/5">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="sr-only">Bot is thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-white/5">
          <div className="flex gap-2">
            <label htmlFor="chat-input" className="sr-only">Ask a question about the scraped data</label>
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about this page..."
              className="input-dark flex-1 text-sm"
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-lg font-medium transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed active:scale-95
                         shadow-lg shadow-blue-900/20 hover:shadow-blue-900/30"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}