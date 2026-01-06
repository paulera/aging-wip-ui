import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { checkAPI, generateChartViaAPI } from './jiraClient';

export default function JiraPage({ onChartGenerated }) {
  // Load from localStorage
  const [jiraUrl, setJiraUrl] = useState(() => localStorage.getItem('jiraUrl') || '');
  const [jiraUser, setJiraUser] = useState(() => localStorage.getItem('jiraUser') || '');
  const [jiraApiToken, setJiraApiToken] = useState(() => localStorage.getItem('jiraApiToken') || '');
  const [jql, setJql] = useState(() => localStorage.getItem('jql') || '');
  const [jqlSLE, setJqlSLE] = useState(() => localStorage.getItem('jqlSLE') || '');
  const [sleWindow, setSleWindow] = useState(() => localStorage.getItem('sleWindow') || '90');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [apiAvailable, setApiAvailable] = useState(false);
  const [apiCheckDone, setApiCheckDone] = useState(false);

  // Check if API is available on mount
  useEffect(() => {
    checkAPI().then(available => {
      setApiAvailable(available);
      setApiCheckDone(true);
    });
  }, []);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('jiraUrl', jiraUrl);
    localStorage.setItem('jiraUser', jiraUser);
    localStorage.setItem('jiraApiToken', jiraApiToken);
    localStorage.setItem('jql', jql);
    localStorage.setItem('jqlSLE', jqlSLE);
    localStorage.setItem('sleWindow', sleWindow);
  }, [jiraUrl, jiraUser, jiraApiToken, jql, jqlSLE, sleWindow]);

  const handleGenerateChart = async () => {
    // Validate inputs
    if (!jiraUrl || !jiraUser || !jiraApiToken || !jql) {
      setError('Please fill in all required fields (Jira URL, User, API Token, and JQL Query)');
      return;
    }

    if (!apiAvailable) {
      setError('Server error. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress('Fetching data from Jira...');
    
    try {
      const chartData = await generateChartViaAPI({
        jiraUrl,
        jiraUser,
        jiraApiToken,
        jql,
        jqlSLE: jqlSLE || undefined,
        sleWindow: sleWindow ? parseInt(sleWindow) : 90
      });
      
      setProgress('Chart generated successfully!');
      
      // Save and navigate
      localStorage.setItem('generatedChartData', JSON.stringify(chartData));
      if (onChartGenerated) {
        onChartGenerated(chartData);
      }
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
      
    } catch (err) {
      console.error('Error generating chart:', err);
      setError(`Failed to generate chart: ${err.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 p-8 font-sans">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Jira Configuration</h1>
          <p className="text-slate-500">Configure your Jira connection to generate aging charts</p>
        </div>
        <a href="/" className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Chart
        </a>
      </div>

      <div className={`border rounded-lg p-4 mb-6 ${apiAvailable ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        {apiCheckDone && apiAvailable ? (
          <>
            <h3 className="text-sm font-semibold text-green-900 mb-2">✓ API Ready</h3>
            <p className="text-sm text-green-800">
              Connected to <code className="bg-green-100 px-1 rounded">/api/chart-data</code>
            </p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Server Not Ready</h3>
            <p className="text-sm text-yellow-800">
              Please refresh the page.
            </p>
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Connection Settings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Jira URL
            </label>
            <input
              type="text"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              placeholder="https://your-domain.atlassian.net"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Jira User Email
            </label>
            <input
              type="email"
              value={jiraUser}
              onChange={(e) => setJiraUser(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Jira API Token
          </label>
          <input
            type="password"
            value={jiraApiToken}
            onChange={(e) => setJiraApiToken(e.target.value)}
            placeholder="Your API token"
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Generate an API token from{' '}
            <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Atlassian Account Settings
            </a>
          </p>
        </div>

        <h2 className="text-lg font-semibold text-slate-800 mb-4 mt-6">Query Settings</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            JQL Query (Current Items)
          </label>
          <textarea
            value={jql}
            onChange={(e) => setJql(e.target.value)}
            placeholder='project = "MYPROJECT" AND status != "Done"'
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            JQL Query (SLE Data)
          </label>
          <textarea
            value={jqlSLE}
            onChange={(e) => setJqlSLE(e.target.value)}
            placeholder='project = "MYPROJECT" AND resolved >= -90d'
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Query to fetch historical data for SLE calculations
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            SLE Window (days)
          </label>
          <input
            type="number"
            value={sleWindow}
            onChange={(e) => setSleWindow(e.target.value)}
            placeholder="90"
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleGenerateChart}
          disabled={isLoading || !jiraUrl || !jiraUser || !jiraApiToken || !jql}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Generating...' : 'Generate Chart'}
        </button>

        {progress && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
            {progress}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
