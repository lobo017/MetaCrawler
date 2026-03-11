'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Loader2 } from 'lucide-react';

const smoothReveal = {
  initial: { opacity: 0, height: 0, marginTop: 0 },
  animate: { opacity: 1, height: 'auto', marginTop: 16, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

const toastVariant = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.2 } },
};

export default function JobController({ onCreated }) {
  const [url, setUrl] = useState('');
  const [type, setType] = useState('auto');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus('Submitting job...');
    setStatusType('info');

    const query = `
      mutation CreateJob($input: CreateJobInput!) {
        createJob(input: $input) {
          id
          status
        }
      }
    `;

    const payload = { url, type };
    if (type === 'ai') payload.text = text;

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { input: payload } }),
      });

      const result = await response.json();
      if (result.errors?.length) {
        setStatus(`Failed: ${result.errors[0].message}`);
        setStatusType('error');
        return;
      }

      setStatus(`Job queued: ${result.data.createJob.id.slice(0, 8)}...`);
      setStatusType('success');
      await onCreated();
    } catch (e) {
      setStatus(`Network error: ${e.message}`);
      setStatusType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Scraping job configuration">
      {/* URL Input */}
      <div>
        <label htmlFor="target-url" className="mb-2 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Target URL
        </label>
        <input
          id="target-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="input-dark w-full font-mono text-sm"
          placeholder="https://example.com"
          required
          aria-describedby="url-hint"
        />
        <p id="url-hint" className="sr-only">Enter the full URL of the website you want to scrape</p>
      </div>

      {/* Scraper Type Selector */}
      <div>
        <label htmlFor="scraper-type" className="mb-2 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Scraper Type
        </label>
        <select
          id="scraper-type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="input-dark w-full text-sm cursor-pointer"
          aria-describedby="type-hint"
        >
          <option value="auto">Auto — Smart Routing</option>
          <option value="site">Full Site Knowledge Base (Crawl and Train)</option>
          <option value="static">Go (Static HTML)</option>
          <option value="dynamic">Node.js (Dynamic / SPA)</option>
          <option value="ai">Python (AI / NLP)</option>
        </select>
        <p id="type-hint" className="sr-only">Select which scraping engine to use, or choose Auto for smart routing</p>
      </div>

      {/* Conditional Panels with smooth height animation */}
      <AnimatePresence mode="wait">
        {type === 'auto' && (
          <motion.div
            key="auto-info"
            variants={smoothReveal}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <div
              className="p-3.5 rounded-lg border border-blue-500/15 bg-blue-500/6 text-[11px] text-blue-200/80 flex items-start gap-2.5"
              role="note"
            >
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Auto mode analyzes the target and routes to either <span className="font-semibold text-white">Static</span> or <span className="font-semibold text-white">Dynamic</span> scraper at runtime.
              </p>
            </div>
          </motion.div>
        )}

        {type === 'ai' && (
          <motion.div
            key="ai-input"
            variants={smoothReveal}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <label htmlFor="nlp-text" className="mb-2 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Text for NLP (optional)
            </label>
            <textarea
              id="nlp-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="input-dark w-full min-h-[100px] text-sm resize-y"
              placeholder="Enter text to analyze with NLP. If blank, the URL content will be used."
              aria-describedby="nlp-hint"
            />
            <p id="nlp-hint" className="sr-only">Enter text to analyze with NLP. If blank, the URL content will be used.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={`w-full py-3 px-4 rounded-xl font-semibold text-white text-sm
                   bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                   border border-white/[0.08] shadow-lg shadow-blue-500/10
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2.5 transition-all duration-300`}
        whileHover={!isSubmitting ? { scale: 1.01, boxShadow: '0 8px 24px -4px rgba(59, 130, 246, 0.25)' } : {}}
        whileTap={!isSubmitting ? { scale: 0.98 } : {}}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Dispatching...
          </>
        ) : (
          'Queue Scraping Job'
        )}
      </motion.button>

      {/* Status Toast */}
      <AnimatePresence mode="wait">
        {status && (
          <motion.div
            key={status}
            className={`toast toast-${statusType}`}
            role="status"
            aria-live="polite"
            variants={toastVariant}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}