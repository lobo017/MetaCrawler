'use client';

import { useState } from 'react';

const placeholders = {
  static: 'https://example.com',
  dynamic: 'https://news.ycombinator.com',
  ai: 'https://example.com/blog-post',
};

export default function JobController({ onCreated }) {
  const [url, setUrl] = useState(placeholders.static);
  const [type, setType] = useState('static');
  const [text, setText] = useState('MetaCrawler is a great platform for scalable web data extraction.');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('Submitting job...');
    setIsSubmitting(true);

    const query = `
      mutation CreateJob($input: CreateJobInput!) {
        createJob(input: $input) {
          id
          status
        }
      }
    `;

    const payload = { url, type };
    if (type === 'ai' && text.trim()) payload.text = text;

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { input: payload } }),
      });

      const result = await response.json();
      if (result.errors?.length) {
        setStatus(`Failed: ${result.errors[0].message}`);
      } else {
        setStatus(`✅ Job ${result.data.createJob.id.slice(0, 8)} created successfully`);
        await onCreated();
      }
    } catch (error) {
      setStatus(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-100">Target URL</label>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={placeholders[type]}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-100">Scraper Type</label>
        <select
          value={type}
          onChange={(event) => {
            const nextType = event.target.value;
            setType(nextType);
            if (!url) setUrl(placeholders[nextType]);
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-cyan-500"
        >
          <option value="static">Go • Static HTML</option>
          <option value="dynamic">Node • Dynamic JS pages</option>
          <option value="ai">Python • NLP analysis</option>
        </select>
      </div>

      {type === 'ai' && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-100">Text for NLP (optional)</label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting…' : 'Start Scraping Job'}
      </button>

      {status && <p className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200">{status}</p>}
    </form>
  );
}
