# Jira Integration Guide

## Overview

The Aging WIP UI now supports direct integration with Jira to automatically generate aging charts from your Jira issues.

## Features

- **Browser-based chart generation**: Enter your Jira credentials and JQL queries directly in the UI
- **Automatic data transformation**: Fetches issues, calculates aging metrics, and renders the chart
- **Persistent configuration**: Your Jira settings are saved in browser localStorage
- **Real-time progress**: See status updates as data is fetched and processed

## How to Use

### Option 1: Local API Server (Recommended - No CORS Issues!)

1. **Start the API server** in one terminal:
   ```bash
   npm run api
   ```
   You'll see: `✓ Jira API Server running on http://localhost:3001`

2. **Start the web app** in another terminal:
   ```bash
   npm run dev
   ```

3. **Navigate to Jira Configuration**
   - Click "Jira Config" in the main chart view, or go to `http://localhost:5173/#/jira`
   - You should see: **✓ Local API Server Active**

4. **Fill in Connection Settings** (same as below)

5. **Configure Query Settings** (same as below)

6. **Generate Chart** - It will use the local server (no CORS issues!)

### Option 2: Direct Browser Calls (Requires CORS Extension)

### Option 2: Direct Browser Calls (Requires CORS Extension)

If you can't run the local server, you can use direct API calls:

1. **Navigate to Jira Configuration**

Click "Jira Config" in the main chart view, or navigate to `#/jira` in your browser.

2. **Fill in Connection Settings**

- **Jira URL**: Your Jira instance URL (e.g., `https://your-domain.atlassian.net`)
- **Jira User Email**: Your email address used for Jira login
- **Jira API Token**: Generate one at [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)

3. **Install CORS Extension** (only needed if local server not running)
   - Install "CORS Unblock" or similar extension
   - Enable it for localhost

4. **Configure Query Settings**

- **JQL Query (Current Items)**: Query to fetch items to display in the chart
  - Example: `project = "MYPROJECT" AND status != "Done"`
- **JQL Query (SLE Data)**: Query to fetch historical data for SLE calculations
  - Example: `project = "MYPROJECT" AND resolved >= -90d`
- **SLE Window (days)**: Number of days to look back for SLE calculations (default: 90)

5. **Generate Chart**

Click the "Generate Chart" button. The app will:
1. Connect to your Jira instance (via local server or direct)
2. Fetch all matching issues (with pagination)
3. Process and transform the data
4. Navigate back to the main chart with your data

## CORS Solutions

### Best Solution: Local API Server (Recommended!)

The CLI tool can run as an API server that proxies requests to Jira:

```bash
npm run api
```

**Benefits:**
- ✅ No CORS issues - server-side requests aren't restricted
- ✅ Uses the same proven CLI code  
- ✅ Automatic detection by the web UI
- ✅ Runs on `http://localhost:3001`

See [API_SERVER.md](API_SERVER.md) for full details.

### Alternative Solutions

1. **Browser Extension (Quick Fix)**:
   - Install a CORS extension like "CORS Unblock" for Chrome or Firefox
   - Enable it when using the Jira integration feature
   - ⚠️ Remember to disable it when done for security

2. **CLI Tool (Batch Processing)**:
   - Use the Node.js CLI tool directly: `cli/get-jira-issues.js`
   - No CORS restrictions
   - Can be automated in CI/CD pipelines
   - Example:
     ```bash
     node cli/get-jira-issues.js \
       --jira-url "https://your-domain.atlassian.net" \
       --jira-user "user@example.com" \
       --jira-api-token "your-token" \
       --jql 'project = "MYPROJECT"' \
       --output data.json
     ```

3. **Proxy Server (Advanced)**:
   - The built-in API server IS a proxy server!
   - Or set up your own custom proxy if needed
   - Update `jiraClient.js` to use the proxy URL

## Data Storage

- **Configuration**: Stored in browser localStorage (persists across sessions)
- **Generated Chart Data**: Stored in localStorage and passed to the main chart
- **Security**: API tokens are stored locally in your browser only

## Implementation Details

The Jira integration consists of:

- **`src/JiraPage.jsx`**: UI for configuration and chart generation
- **`src/jiraClient.js`**: Client-side API wrapper for Jira REST API
- **Integration with App.jsx**: Accepts generated data and displays it

### API Endpoints Used

- `/rest/api/3/search`: Fetch issues with JQL
  - Includes changelog for historical data
  - Paginated (100 results per page)
  - Rate-limited (100ms between requests)

### Data Transformation

1. **Fetch Issues**: Get all issues matching the JQL query
2. **Extract Metadata**: Parse issue fields (status, type, assignee, etc.)
3. **Calculate Aging**: Compute days since creation
4. **Group by Status**: Organize items into columns
5. **Format for Chart**: Transform into the chart's expected JSON structure

## Troubleshooting

### "Jira API error: 401"
- Check that your email and API token are correct
- Verify the API token hasn't expired

### "Jira API error: 400"
- Check that your JQL syntax is valid
- Test the JQL in Jira's issue search first

### "Failed to fetch" or CORS errors
- Enable a CORS browser extension
- Or use the CLI tool instead

### "No issues found"
- Verify your JQL query returns results in Jira
- Check that you have permission to view those issues

## Security Considerations

- API tokens are stored in browser localStorage (plain text)
- Tokens are only transmitted over HTTPS to Jira
- Consider using the CLI tool for sensitive environments
- Clear localStorage to remove stored credentials

## Future Enhancements

- [ ] SLE calculation using historical data (currently simplified)
- [ ] Status metadata fetching for better categorization
- [ ] Column order configuration
- [ ] Theme customization in the UI
- [ ] Export/import of configuration
- [ ] Proxy server option to avoid CORS
