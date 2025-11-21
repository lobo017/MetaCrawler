/**
 * MetaCrawler - Job Controller Component
 * --------------------------------------
 * A form component to submit new scraping jobs.
 * Allows user to select URL, scraping type (Static/Dynamic), and AI options.
 */

// 'use client';
// import { useState } from 'react';

// export default function JobController() {
//   const [url, setUrl] = useState('');
//   const [type, setType] = useState('static');

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     // Call API Gateway to create job
//     console.log('Submitting job:', { url, type });
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       <div>
//         <label className="block text-sm font-medium">Target URL</label>
//         <input 
//           type="url" 
//           value={url}
//           onChange={(e) => setUrl(e.target.value)}
//           className="w-full border p-2 rounded"
//           placeholder="https://example.com"
//         />
//       </div>
      
//       <div>
//         <label className="block text-sm font-medium">Scraper Type</label>
//         <select 
//           value={type} 
//           onChange={(e) => setType(e.target.value)}
//           className="w-full border p-2 rounded"
//         >
//           <option value="static">Go (Static HTML - Fast)</option>
//           <option value="dynamic">Node.js (Browser - Slow)</option>
//           <option value="ai">Python (AI Analysis)</option>
//         </select>
//       </div>

//       <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
//         Start Scraping
//       </button>
//     </form>
//   );
// }
