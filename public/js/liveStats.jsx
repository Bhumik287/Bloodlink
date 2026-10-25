/**
 * BloodLink - Live Stats React Component (.jsx)
 * Demonstrates basic React.js concepts:
 * - Functional Component
 * - JSX syntax
 * - React.useState for local state
 * - React.useEffect for lifecycle data fetching via REST API
 */

const { useState, useEffect } = React;

function LiveStatsCard() {
  const [stats, setStats] = useState({ openRequests: '...', totalDonors: '...', fulfilledRequests: '...' });

  useEffect(() => {
    fetch('/api/requests/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch(() => {
        setStats({ openRequests: 0, totalDonors: 0, fulfilledRequests: 0 });
      });
  }, []);

  return (
    <div className="card border border-slate-200 rounded-2xl shadow-sm overflow-hidden bg-slate-50">
      <div className="card-header bg-white border-b border-slate-200 px-4 py-3 font-bold text-slate-700 flex items-center justify-between">
        <span>Live Database Summary</span>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
      </div>
      <ul className="list-group list-group-flush divide-y divide-slate-100">
        <li className="list-group-item bg-white px-4 py-3 flex justify-between items-center text-sm font-medium text-slate-700">
          <span>Open Blood Requests:</span>
          <span className="badge bg-crimson-600 text-white font-bold px-2.5 py-1 rounded-full" id="stat-open-requests">
            {stats.openRequests}
          </span>
        </li>
        <li className="list-group-item bg-white px-4 py-3 flex justify-between items-center text-sm font-medium text-slate-700">
          <span>Registered Donors:</span>
          <span className="badge bg-slate-600 text-white font-bold px-2.5 py-1 rounded-full" id="stat-total-donors">
            {stats.totalDonors}
          </span>
        </li>
        <li className="list-group-item bg-white px-4 py-3 flex justify-between items-center text-sm font-medium text-slate-700">
          <span>Fulfilled Requests:</span>
          <span className="badge bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-full" id="stat-fulfilled">
            {stats.fulfilledRequests}
          </span>
        </li>
      </ul>
      <div className="card-footer bg-slate-50 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Rendered with Basic React.js (<span className="text-crimson-600 font-semibold">useState</span> & <span className="text-crimson-600 font-semibold">useEffect</span>)
      </div>
    </div>
  );
}

// Mount to DOM root element
const rootElement = document.getElementById('react-stats-root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<LiveStatsCard />);
}
