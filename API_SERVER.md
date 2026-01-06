# Jira API Server

The `get-jira-issues.js` tool can run as both a CLI tool and an API server, solving CORS issues when generating charts from the browser.

## Quick Start

### Start the API Server

```bash
npm run api
```

Or directly:

```bash
node cli/get-jira-issues.js --server
```

The server will start on `http://localhost:3001` (or `PORT` environment variable).

### Use the Web Interface

1. Keep the API server running in one terminal
2. Start the web app in another terminal: `npm run dev`
3. Navigate to `http://localhost:5173/#/jira`
4. You'll see: **✓ Local API Server Active**
5. Fill in your Jira credentials and click "Generate Chart"

## Benefits

- **No CORS issues**: Server-side requests don't have browser CORS restrictions
- **Same code**: Uses the exact same logic as the CLI tool
- **Automatic detection**: Web UI automatically detects if the server is running
- **Fallback**: If server isn't running, can still use direct API calls with CORS extension

## API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok"
}
```

### Generate Chart
```bash
POST /generate-chart
Content-Type: application/json

{
  "jiraUrl": "https://your-domain.atlassian.net",
  "jiraUser": "user@example.com",
  "jiraApiToken": "your-api-token",
  "jql": "project = \"MYPROJECT\" AND status != \"Done\"",
  "jqlSLE": "project = \"MYPROJECT\" AND resolved >= -90d",
  "sleWindow": 90
}
```

Response: Chart data in JSON format (same as CLI output)

### Error Responses

```json
{
  "error": "Error message here"
}
```

## Environment Variables

You can set these instead of passing credentials in the request:

```bash
export JIRA_URL="https://your-domain.atlassian.net"
export JIRA_USER="user@example.com"
export JIRA_API_TOKEN="your-token"
export PORT=3001  # Optional, defaults to 3001
```

## Development

The API server uses the same `JiraClient` class and transformation functions as the CLI tool, ensuring consistency.

Both modes share:
- Authentication logic
- API pagination
- Rate limiting
- SLE calculations
- Data transformation

## Troubleshooting

### Server not detected by web UI

Check:
1. Server is running: `curl http://localhost:3001/health`
2. No port conflicts (change with `PORT=3002 npm run api`)
3. Browser console for connection errors

### Server errors

Run with verbosity to see details:
```bash
node cli/get-jira-issues.js --server -vv
```

### Port already in use

Change the port:
```bash
PORT=3002 npm run api
```

Then update `LOCAL_API_URL` in `src/jiraClient.js` if needed.
