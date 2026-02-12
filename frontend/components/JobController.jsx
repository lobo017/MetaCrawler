'use client';

import { useState } from 'react';

export default function JobController({ onCreated }) {
  const [url, setUrl] = useState('https://example.com');
  const [type, setType] = useState('auto');
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

    try {
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

      setStatus(`Job started: ${result.data.createJob.id.slice(0, 8)}...`);
      await onCreated();
    } catch (e) {
      setStatus(`Network error: ${e.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Target URL</label>
        <input 
          type="url" 
          value={url} 
          onChange={(event) => setUrl(event.target.value)} 
          className="input-dark w-full font-mono text-sm" 
          placeholder="https://example.com"
          required 
        />
      </div>
      
      <div>
        <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Scraper Type</label>
        <select 
          value={type} 
          onChange={(event) => setType(event.target.value)} 
          className="input-dark w-full text-sm"
        >
          <option value="auto">Auto • Let MetaCrawler choose</option>
          <option value="static">Go (Static HTML)</option>
          <option value="dynamic">Node.js (Dynamic)</option>
          <option value="ai">Python (AI/NLP)</option>
        </select>
      </div>

      {type === 'auto' && (
        <div className="p-3 rounded border border-blue-500/30 bg-blue-500/10 text-[11px] text-blue-200 flex items-start gap-2">
          <span className="text-blue-400 text-lg leading-none">ℹ</span>
          <p>Auto mode analyzes the target website and chooses <span className="font-bold text-white">Static</span> or <span className="font-bold text-white">Dynamic</span> scraper at runtime.</p>
        </div>
      )}

      {type === 'ai' && (
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Text for NLP (optional)</label>
          <textarea 
            value={text} 
            onChange={(event) => setText(event.target.value)} 
            className="input-dark w-full min-h-[100px] text-sm" 
          />
        </div>
      )}

      <button 
        type="submit" 
        className="w-full py-3 px-4 rounded-lg font-bold text-white text-sm transition-all 
                   bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 
                   shadow-[0_0_20px_rgba(59,130,246,0.3)] border border-white/10 active:scale-[0.98]"
      >
        Start Scraping Job
      </button>
      
      {status && <p className="text-xs text-center text-slate-400 animate-pulse">{status}</p>}
    </form>
  );
}