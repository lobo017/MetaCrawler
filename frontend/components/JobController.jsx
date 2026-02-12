'use client';

import { useState } from 'react';

export default function JobController({ onCreated }) {
  const [url, setUrl] = useState('');
  const [type, setType] = useState('auto');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'info' | 'success' | 'error'
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

      setStatus(`Job started: ${result.data.createJob.id.slice(0, 8)}...`);
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
        <label htmlFor="target-url" className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
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
        <label htmlFor="scraper-type" className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
          Scraper Type
        </label>
        <select
          id="scraper-type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="input-dark w-full text-sm cursor-pointer"
          aria-describedby="type-hint"
        >
          <option value="auto">⚡ Auto • Let MetaCrawler choose</option>
          <option value="static">🏗️ Go (Static HTML)</option>
          <option value="dynamic">🌐 Node.js (Dynamic / SPA)</option>
          <option value="ai">🤖 Python (AI / NLP)</option>
        </select>
        <p id="type-hint" className="sr-only">Select which scraping engine to use, or choose Auto for smart routing</p>
      </div>

      {/* Auto mode info card */}
      {type === 'auto' && (
        <div
          className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-[11px] text-blue-200 flex items-start gap-2 animate-slide-down"
          role="note"
        >
          <span className="text-blue-400 text-lg leading-none" aria-hidden="true">ℹ</span>
          <p>Auto mode analyzes the target website and chooses <span className="font-bold text-white">Static</span> or <span className="font-bold text-white">Dynamic</span> scraper at runtime.</p>
        </div>
      )}

      {/* AI text input */}
      {type === 'ai' && (
        <div className="animate-slide-down">
          <label htmlFor="nlp-text" className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Text for NLP (optional)
          </label>
          <textarea
            id="nlp-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="input-dark w-full min-h-[100px] text-sm resize-y"
            aria-describedby="nlp-hint"
          />
          <p id="nlp-hint" className="sr-only">Enter text to analyze with NLP. If blank, the URL content will be used.</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={`w-full py-3 px-4 rounded-lg font-bold text-white text-sm transition-all duration-300
                   bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 
                   shadow-[0_0_20px_rgba(59,130,246,0.3)] border border-white/10 
                   active:scale-[0.97] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                   flex items-center justify-center gap-2`}
      >
        {isSubmitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </>
        ) : (
          'Start Scraping Job'
        )}
      </button>

      {/* Status Toast */}
      {status && (
        <div
          className={`toast toast-${statusType} animate-slide-down`}
          role="status"
          aria-live="polite"
        >
          {status}
        </div>
      )}
    </form>
  );
}