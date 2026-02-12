'use client';

import { useState } from 'react';

export default function JobController({ onCreated }) {
  const [url, setUrl] = useState('https://example.com');
  const [type, setType] = useState('static');
  const [text, setText] = useState('MetaCrawler is a great platform for scalable web data extraction.');
  const [status, setStatus] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('Submitting...');

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

    const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { input: payload } }),
    });

    const result = await response.json();
    if (result.errors?.length) {
      setStatus(`Failed: ${result.errors[0].message}`);
      return;
    }

    setStatus(`Created job ${result.data.createJob.id}`);
    await onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Target URL</label>
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} className="w-full rounded border border-gray-300 p-2" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Scraper Type</label>
        <select value={type} onChange={(event) => setType(event.target.value)} className="w-full rounded border border-gray-300 p-2">
          <option value="static">Go (Static HTML)</option>
          <option value="dynamic">Node.js (Dynamic)</option>
          <option value="ai">Python (AI/NLP)</option>
        </select>
      </div>
      {type === 'ai' && (
        <div>
          <label className="mb-1 block text-sm font-medium">Text for NLP (optional)</label>
          <textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-24 w-full rounded border border-gray-300 p-2" />
        </div>
      )}
      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Start Scraping</button>
      {status && <p className="text-sm text-gray-600">{status}</p>}
    </form>
  );
}
