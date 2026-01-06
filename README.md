# Aging WIP Chart

## Project Overview

This is a Kanban board visualization that displays work items aging over time across different workflow columns. It's designed to help teams identify bottlenecks by showing how long items have been in each stage.

### Key Features

- **Aging Visualization**: Items are positioned vertically based on their age in days, with color-coded SLE (Service Level Expectation) zones
- **Dependency Tracking**: Shows arrows between dependent items (e.g., KAN-205 depends on KAN-202)
- **Multi-field Filtering**: Filter by type, assignee, label, parent epic, and priority
- **Priority Support**: Visual indicators showing priority levels with urgency-based border widths
- **Interactive Pinning**: Hover over items and press 'P' to pin cards, drag pinned cards around the chart
- **Card Color Modes**: Toggle between type-based and SLE-based card title colors
- **SLE Toggles**: Show/hide SLE zones and values independently
- **Percentile Markers**: Hover over columns to see SLE percentile markers on the Y-axis
- **Theme System**: Fully customizable themes controlling all visual aspects (colors, icons, priorities)
- **Data-Driven Configuration**: The entire board is configured via JSON data structure
- **Jira Integration**: Browser-based UI and CLI tool to fetch issues directly from Jira API

### Technical Stack

- Framework: React 19 with Vite 7
- Styling: Tailwind CSS 4.x
- Icons: Lucide React
- Build: Single-file build output using vite-plugin-singlefile
- CLI: Standalone Node.js script (no dependencies)

## Quick Start

```bash
npm run dev
```

Then open `http://localhost:5173` in your browser.

- `/` - Main aging chart view
- `/config` - Jira configuration and chart generation
- `/api/chart-data` - API endpoint (handled by Vite)

### Data Flow

The app can load data in multiple ways:

- **Jira UI Integration**: Navigate to `#/jira` to configure and fetch data directly from Jira
  - **Local API Server** (recommended): Run `npm run api` to start a proxy server (no CORS issues)
  - **Direct API**: Use with CORS browser extension as fallback
  - See [JIRA_INTEGRATION.md](JIRA_INTEGRATION.md) and [API_SERVER.md](API_SERVER.md)
- **URL Parameter**: Base64 or URL-encoded JSON via `?data=` query parameter (see [`.vscode/launch.json`](.vscode/launch.json))
- **CLI Tool**: Fetch live data from Jira using [`cli/get-jira-issues.js`](cli/get-jira-issues.js)
- **Fallback**: Mock data hardcoded in [`src/App.jsx`](src/App.jsx)

The data structure includes:

- Board metadata (title, subtitle, date range)
- **Theme configuration** (colors, type definitions, priority mappings, SLE colors)
- Feature flags (dependencies, filters)
- Columns with SLE thresholds
- Work items with metadata (type, assignee, labels, parent epic, dependencies, priority, urgency)

### Key Components

- **App.jsx**: Main component with filtering, layout calculation, and rendering logic
- **StatusColumn**: Renders individual workflow columns with SLE zones
- **ItemDot**: Interactive work item dots with hover tooltips and urgency-based borders
- **SmartTooltip**: Boundary-aware tooltip with item details including priority
- **MultiSelect**: Custom dropdown filter component
- **FilterBar**: Filter controls with dependency toggle

### Notable Implementation Details

- Layout uses percentage-based positioning for responsive scaling
- SVG overlay for dependency arrows with dynamic arrowhead positioning
- Data is embedded as HTML comment in built output for portability
- Horizontal scrolling container ensures SVG arrows align with columns even when content overflows
- **Theme-based type system**: No hardcoded type logic - all types, colors, and icons configured via theme
- **Priority visualization**: Border width calculated as `2px + (urgency × 2)`
- **Centralized SLE colors**: All columns share the same color palette from theme

### Build Output

The build process creates a single HTML file (via vite-plugin-singlefile) that's completely self-contained and portable.

## CLI Tool

### Quick Start

```bash
# 1. Set up environment
cd cli
cp .env.example .env
# Edit .env with your Jira credentials

# 2. Fetch issues and pipe to file
node get-jira-issues.js -j "project = MYPROJ AND status != Done" > output.json

# 3. View in browser
# Load the UI and paste the base64-encoded JSON into the URL parameter
```

### CLI Usage

```bash
node cli/get-jira-issues.js -j "JQL QUERY" [options]
```

**Required:**
- `-j, --jql <query>` - JQL query to fetch issues

**Options:**
- `-d, --date <YYYY-MM-DD>` - Reference date for age calculation (default: today)
- `-t, --theme <path>` - Path to theme JSON file (default: built-in theme)
- `-v, --verbose` - Verbose logging to stderr
- `-vv, --debug` - Debug logging to stderr
- `-vvv, --trace` - Trace logging to stderr

**Environment Variables:**
Set in `.env` file or environment:
- `JIRA_URL` - Jira base URL (e.g., https://company.atlassian.net)
- `JIRA_USER` - Jira email address
- `JIRA_API_TOKEN` - Jira API token

**Examples:**

```bash
# Basic usage
node cli/get-jira-issues.js -j "project = MYPROJ"

# With custom date
node cli/get-jira-issues.js -j "assignee = currentUser()" -d 2024-01-15

# With custom theme and verbose logging
node cli/get-jira-issues.js -j "filter = 12345" -t custom-theme.json -v

# Pipe to file
node cli/get-jira-issues.js -j "project = MYPROJ" > output.json

# Generate base64 for URL
node cli/get-jira-issues.js -j "project = MYPROJ" | base64
```

See [`PROJECT.md`](PROJECT.md) for detailed CLI documentation.