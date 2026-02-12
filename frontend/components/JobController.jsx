'use client';

import { useState } from 'react';

const placeholders = {
  auto: 'https://example.com',
  static: 'https://example.com',
  dynamic: 'https://news.ycombinator.com',
  ai: 'https://example.com/blog-post',
};

export default function JobController({ onCreated }) {
  const [url, setUrl] = useState(placeholders.auto);
  const [type, setType] = useState('auto');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('');
    setIsSubmitting(true);

    const query = `
      mutation CreateJob($input: CreateJobInput!) {
        createJob(input: $input) {
          id
          status
          type
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
        const created = result.data.createJob;
        setStatus(`Job submitted. Selected scraper: ${created.type}.`);
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
      <h2 className="text-4xl font-semibold text-slate-200">Start New Job</h2>

      <div>
        <label className="mb-1 block text-xl text-slate-500">Target URL</label>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={placeholders[type]}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xl text-slate-700 outline-none focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xl text-slate-500">Scraper Type</label>
        <select
          value={type}
          onChange={(event) => {
            const next = event.target.value;
            setType(next);
            if (!url) setUrl(placeholders[next]);
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xl text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="auto">Auto (Choose for me)</option>
          <option value="static">Go (Static HTML)</option>
          <option value="dynamic">Node (Dynamic JS)</option>
          <option value="ai">Python (NLP)</option>
        </select>
      </div>

      {type === 'auto' && (
        <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Auto mode inspects the target site and selects static or dynamic scraping automatically.
        </p>
      )}

      {type === 'ai' && (
        <div>
          <label className="mb-1 block text-xl text-slate-500">Text for NLP (optional)</label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-700 outline-none focus:border-blue-500"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-6 py-2 text-2xl font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting…' : 'Start Scraping'}
      </button>

      {status ? <p className="text-base text-slate-600">{status}</p> : null}
    </form>
  );
}
