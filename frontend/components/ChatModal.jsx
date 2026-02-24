'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function ChatModal({ job, onClose }) {
  const isSiteMode = job.type.startsWith('site');
  
  const [messages, setMessages] = useState([
    { role: 'bot', text: `I have analyzed ${isSiteMode ? 'the site corpus for' : 'the content from'} ${job.url}. Ask me anything!` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Fetch chat history from MongoDB when modal opens
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
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-panel w-full max-w-lg flex flex-col overflow-hidden h-[600px] shadow-2xl animate-fade-in-up">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <span aria-hidden="true">🤖</span> Data Q&A Bot
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[300px]" title={job.url}>{job.url}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-90">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`} style={{ animationDelay: `${i * 30}ms` }}>
              <div className={`max-w-[80%] p-3 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 border border-white/5 rounded-bl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-slate-800 p-3 rounded-xl rounded-bl-none border border-white/5">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-white/5">
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
            <button type="submit" disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50">Send</button>
          </div>
        </form>
      </div>
    </div>
  );
}