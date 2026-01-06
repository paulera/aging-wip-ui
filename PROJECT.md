# Aging WIP Visualization

A Kanban board visualization tool that displays work items aging over time across workflow columns. Helps teams identify bottlenecks by showing how long items have been in each stage with color-coded Service Level Expectation (SLE) zones.

## Features

- **Aging Visualization**: Items positioned vertically based on their age in days
- **SLE Zones**: Color-coded zones showing service level expectations (configurable via theme)
- **Dependency Tracking**: Visual arrows showing dependencies between work items
- **Advanced Filtering**: Filter by type, assignee, label, parent epic, and priority
- **Priority System**: Visual indicators with urgency-based border widths
- **Theme System**: Fully customizable themes controlling all visual aspects
- **Portable Output**: Builds to a single, self-contained HTML file
- **Data-Driven**: Entire board configured via JSON

## Prerequisites

Before you begin, ensure you have installed:

- **Node.js** (version 18 or higher)
  - Linux: `sudo apt install nodejs npm` (Ubuntu/Debian) or `sudo dnf install nodejs npm` (Fedora)
  - macOS: `brew install node`
  - WSL: Follow Linux instructions above
- **Git** (for cloning the repository)

To verify installation:
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd aging-wip-ui
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

The application will start at `http://localhost:5173`

### 4. Build for production

```bash
npm run build
```

This creates a single HTML file in the `dist/` directory that can be shared or deployed anywhere.

## Loading Custom Data

### Option 1: URL Parameter (Recommended)

Encode your JSON data and pass it via the `data` query parameter:

```bash
# Using the url-generator tool
node tools/url-generator.js
```

This outputs a base64-encoded string. Use it like:
```
http://localhost:5173?data=<base64-encoded-json>
```

### Option 2: Modify Mock Data

Edit the `MOCK_DATA` constant in [`src/App.jsx`](src/App.jsx) for quick testing during development.

## Data Structure

The application expects a JSON object with the following structure:

```json
{
  "title": "Team Name - Aging WIP",
  "subtitle": "As of 2024/06/23",
  "board_url": "https://your-board-url.com",
  "min_days": 0,
  "max_days": 30,
  "theme": {
    "theme_name": "Default Theme",
    "theme_author_name": "Your Name",
    "theme_author_email": "your.email@example.com",
    "sle_colors": ["#86efac", "#fef08a", "#fde047", "#fdba74", "#fca5a5"],
    "types": {
      "Task": { "color": "#3b82f6", "icon": "✓" },
      "Bug": { "color": "#ef4444", "icon": "🐛" },
      "Story": { "color": "#10b981", "icon": "📖" }
    },
    "priorities": {
      "Highest": "🔴",
      "High": "🟠",
      "Medium": "🟡",
      "Low": "🟢",
      "Lowest": "⚪"
    }
  },
  "features": {
    "dependencies": {
      "enabled": true,
      "show_toggle": true,
      "default_visible": true,
      "arrow_color": "#303030",
      "arrow_thickness": 2
    },
    "filters": {
      "enabled": true,
      "fields": ["type", "assignee", "label", "parent", "priority"]
    }
  },
  "columns": [
    {
      "name": "Column Name",
      "top_text": "Optional text below column name at top",
      "bottom_text": "Optional text below column name at bottom",
      "order": 1,
      "sle": {
        "step1": 2,
        "step2": 5,
        "step3": 7,
        "step4": 12
      },
      "items": [
        {
          "key": "ITEM-123",
          "title": "Work Item Title",
          "type": "Task",
          "age": 5,
          "priority": "High",
          "urgency": 3,
          "assignee": {
            "name": "John Doe",
            "picture": "",
            "link": "#"
          },
          "labels": ["Backend", "Urgent"],
          "parent": {
            "key": "EPIC-1",
            "title": "Epic Title",
            "url": "#"
          },
          "url": "https://jira.example.com/browse/ITEM-123",
          "depends_on": "ITEM-122",
          "label": "123"
        }
      ]
    }
  ]
}
```

### Field Descriptions

#### Root Level
- **title** (string): Main board title
- **subtitle** (string): Subtitle, typically showing the data date
- **board_url** (string): Link to the original board
- **min_days** (number): Minimum age for visualization (typically 0)
- **max_days** (number): Maximum age for visualization scale

#### Theme
- **theme_name** (string): Name of the theme
- **theme_author_name** (string): Theme author's name
- **theme_author_email** (string): Theme author's email
- **sle_colors** (array): Array of hex colors for SLE zones (shared across all columns)
- **types** (object): Type definitions mapping type name to:
  - **color** (string): Hex color for the type
  - **icon** (string): Emoji or text icon to display
- **priorities** (object): Priority mappings from priority name to emoji/icon

#### Features
- **dependencies.enabled** (boolean): Enable/disable dependency arrows
- **dependencies.show_toggle** (boolean): Show toggle button in UI
- **dependencies.default_visible** (boolean): Initial visibility state
- **dependencies.arrow_color** (string): Hex color for arrows
- **dependencies.arrow_thickness** (number): Arrow stroke width
- **filters.enabled** (boolean): Enable/disable filter bar
- **filters.fields** (array): Which fields to filter by (`type`, `assignee`, `label`, `parent`, `priority`)

#### Columns
- **name** (string): Column display name - shown at top and bottom with WIP count: "Column Name (3)"
- **top_text** (string, optional): Additional text displayed below column name at the top
- **bottom_text** (string, optional): Additional text displayed below column name at the bottom
- **order** (number): Column sort order (can be overridden by CLI `--columns-order` parameter)
- **sle** (array or object or null): Service Level Expectations
  - **Array format** (recommended): `[7, 12, 15, 20]` - values map to configured percentiles
  - **Object format** (legacy): `{ "step1": 2, "step2": 5, "step3": 7, "step4": 12 }`
  - **null**: No SLE data - column displays with neutral gray background
  - Colors are pulled from `theme.sle_colors` array in sequence
  - If more steps than colors, remaining steps use transparent
  - If more colors than steps, extra colors are unused

#### Items
- **key** (string, required): Unique item identifier
- **title** (string, required): Item title
- **type** (string): Item type (must match a key in `theme.types`)
- **age** (number, required): Age in days since first stable exit from TODO status category
- **age_in_current_state** (number, optional): Days in current status (displayed as "X of Y days")
- **priority** (string): Priority level (must match a key in `theme.priorities`)
- **urgency** (integer): Urgency level (0-4+) - affects border width: `2px + (urgency × 2)`
- **assignee.name** (string): Assignee name
- **assignee.picture** (string): URL to profile picture (optional)
- **assignee.link** (string): URL to assignee profile
- **labels** (array): Array of label strings
- **parent.key** (string): Parent epic/feature key
- **parent.title** (string): Parent epic/feature title
- **parent.url** (string): URL to parent item
- **url** (string): URL to the work item
- **depends_on** (string, optional): Key of item this depends on
- **label** (string, optional): Custom label to display on dot (overrides type icon)

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## VS Code Debugging

The project includes launch configurations in [`.vscode/launch.json`](.vscode/launch.json):

1. **Launch with no param**: Opens the app with mock data
2. **Launch with Team Beta**: Opens with pre-configured sample data (requires running url-generator)

Press `F5` in VS Code to start debugging.

## Project Structure

```
aging-wip-ui/
├── src/
│   ├── App.jsx       # Main application component
│   ├── App.css       # Component styles
│   ├── index.css     # Global styles (Tailwind)
│   └── main.jsx      # React entry point
├── tools/
│   └── url-generator.js  # Helper to generate data URLs
├── public/           # Static assets
├── vite.config.js    # Vite configuration
└── package.json      # Dependencies and scripts
```

## Architecture Notes

### Theme System
The theme system provides complete control over visual styling:
- **Type definitions**: No hardcoded types - all defined in theme with color and icon
- **Priority mappings**: Configurable emoji/icon per priority level
- **SLE colors**: Centralized color palette shared across all columns
- **Extensible**: Add any number of types or priorities via theme

### Priority & Urgency
- **Priority**: String value (e.g., "High", "Lowest") - displayed with emoji from theme
- **Urgency**: Integer value (0-4+) - affects visual weight via border width formula
- Filtering supports priority field

### SLE Zone Behavior
- Colors defined in `theme.sle_colors` array
- Each column's `sle` object defines step thresholds
- Colors applied in order: `step1` uses `sle_colors[0]`, `step2` uses `sle_colors[1]`, etc.
- Final zone (above last step) uses `sle_colors[stepCount]`
- Missing colors default to transparent

## CLI Tool: Fetching Data from Jira

The project includes a standalone CLI tool that fetches issues directly from Jira's API and transforms them into the JSON format required by the UI.

### Setup

1. **Navigate to CLI directory:**
   ```bash
   cd cli
   ```

2. **Configure credentials:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your Jira credentials:
   ```bash
   JIRA_URL=https://your-company.atlassian.net
   JIRA_USER=your.email@company.com
   JIRA_API_TOKEN=your_api_token_here
   ```

   **Get your API token:** https://id.atlassian.com/manage-profile/security/api-tokens

3. **Test the connection:**
   ```bash
   node get-jira-issues.js -j "project = MYPROJ" -v
   ```

### Usage

**Basic syntax:**
```bash
node get-jira-issues.js -j "JQL QUERY" [options]
```

**Required Parameters:**
- `-j, --jql <query>` - JQL query to fetch issues

**Optional Parameters:**
- `-d, --date <YYYY-MM-DD>` - Reference date for age calculations (default: today)
- `-t, --theme <path>` - Path to custom theme JSON file
- `-o, --columns-order <col1,col2,...>` - Comma-separated list of column names to define order- `-p, --percentiles <list>` - Comma-separated percentiles for SLE calculation (default: 50,75,85,90)
- `-w, --sle-window <window>` - Window for SLE data: `Xd` (days), `YYYY-MM-DD` (date), or count (default: 90d)
- `-s, --sle-jql <query>` - JQL query to fetch historical data for SLE calculation- `-v, --verbose` - Enable verbose logging to stderr
- `-vv, --debug` - Enable debug logging (includes verbose)
- `-vvv, --trace` - Enable trace logging (includes debug + verbose)
- `-h, --help` - Show help message

### Examples

**1. Basic query:**
```bash
node cli/get-jira-issues.js -j "project = MYPROJECT AND status != Done"
```

**2. Filter by assignee with custom date:**
```bash
node cli/get-jira-issues.js -j "assignee = currentUser() AND status IN ('In Progress', 'Review')" -d 2024-01-15
```

**3. Use saved filter:**
```bash
node cli/get-jira-issues.js -j "filter = 12345"
```

**4. Custom theme with verbose output:**
```bash
node cli/get-jira-issues.js -j "project = MYPROJ" -t my-theme.json -v
```

**5. Custom column order:**
```bash
node cli/get-jira-issues.js -j "project = MYPROJ" -o "Backlog,To Do,In Progress,Review,QA,Blocked,Ready to Deploy,On Production,Done"
```

**6. Save output to file:**
```bash
node cli/get-jira-issues.js -j "project = MYPROJ" > output.json
```

**7. Calculate SLEs from last 90 days:**
```bash
node cli/get-jira-issues.js \
  -j "project = MYPROJ AND status != Done" \
  -s "project = MYPROJ AND status = Done AND resolutiondate >= -90d" \
  -w 90d -p 50,75,85,90 -v
```

**8. Calculate SLEs using latest 100 transitions:**
```bash
node cli/get-jira-issues.js \
  -j "project = MYPROJ AND status != Done" \
  -s "project = MYPROJ AND status = Done" \
  -w 100 -v
```

**9. Generate base64 for URL parameter:**
```bash
# On Linux/macOS:
node cli/get-jira-issues.js -j "project = MYPROJ" | base64 -w 0

# On Windows (PowerShell):
node cli/get-jira-issues.js -j "project = MYPROJ" | Out-String | % { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_)) }
```

### Custom Themes

Create a JSON file with your theme configuration:

```json
{
  "theme_name": "My Custom Theme",
  "theme_author_name": "Your Name",
  "theme_author_email": "your.email@example.com",
  "sle_colors": ["#86efac", "#fef08a", "#fde047", "#fdba74", "#fca5a5"],
  "types": {
    "Task": { "color": "#3b82f6", "borderColor": "#2563eb", "icon": "TA" },
    "Bug": { "color": "#ef4444", "borderColor": "#dc2626", "icon": "BU" },
    "Story": { "color": "#10b981", "borderColor": "#059669", "icon": "US" },
    "Epic": { "color": "#8b5cf6", "borderColor": "#7c3aed", "icon": "EP" }
  },
  "priorities": {
    "Highest": "🔴",
    "High": "🟠",
    "Medium": "🟡",
    "Low": "🟢",
    "Lowest": "⚪"
  }
}
```

Then use it:
```bash
node cli/get-jira-issues.js -j "project = MYPROJ" -t my-theme.json
```

**Note:** The CLI tool auto-detects issue types and priorities from your Jira data and adds them to the theme if they're not already defined.

### Service Level Expectations (SLEs)

SLEs are calculated from historical data to show how long items typically spend in each status. This helps identify bottlenecks and set realistic expectations.

**How It Works:**

1. **Fetch Historical Data**: Use `--sle-jql` to specify a query for historical issues (typically completed items)
2. **Extract Transitions**: Analyze changelog to find all transitions OUT of each status
3. **Apply Window**: Filter transitions based on `--sle-window`:
   - `90d`: Transitions in last 90 days before reference date
   - `2024-01-01`: All transitions from this date forward
   - `100`: Latest 100 transitions per status
4. **Calculate Percentiles**: Compute specified percentiles (default: 50th, 75th, 85th, 90th)
5. **Match to Columns**: Assign calculated SLEs to columns by matching status IDs

**Example:**
```bash
# Calculate SLEs from completed items in last 90 days
node cli/get-jira-issues.js \
  -j "project = MYPROJ AND status IN ('In Progress', 'Review')" \
  -s "project = MYPROJ AND status = Done AND resolutiondate >= -90d" \
  -w 90d -p 50,75,85,90 -vv
```

**Interpreting Results:**
- If 85th percentile = 7 days: 85% of items exit this status within 7 days
- Items older than highest percentile appear in the red zone
- Without `--sle-jql`, columns show neutral gray (no SLE data)

**Age Calculation:**
- **Total Age**: Days since first stable exit from TODO status category (measures client wait time)
- **Current State Age**: Days since most recent entry into current status
- Displayed as "X of Y days" when different (e.g., "3 of 15 days")

### How It Works

1. **Authentication:** Uses Basic Auth with your Jira email and API token
2. **Data Fetching:** 
   - Executes your JQL query via `/rest/api/3/search/jql` endpoint
   - Handles pagination automatically (100 issues per page)
   - Respects rate limits (100ms delay between requests)
3. **Transformation:**
   - Groups issues by status into columns
   - Calculates age from creation date (will be enhanced later for transition-based aging)
   - Extracts dependencies from issue links
   - Maps priorities to urgency levels (0-4)
4. **Output:** Writes valid JSON to stdout (all logs go to stderr for clean piping)

### Current Limitations (To Be Enhanced)

- **SLE thresholds:** Currently set to 10 days for all steps (will be configurable per column later)
- **Age calculation:** Based on creation date (will support transition-based calculations later)

### Troubleshooting

**"Missing required configuration" error:**
- Ensure `.env` file exists in `cli/` directory
- Verify all three variables are set: `JIRA_URL`, `JIRA_USER`, `JIRA_API_TOKEN`

**"HTTP 401 Unauthorized" error:**
- Check that your API token is valid
- Verify your email address is correct
- Ensure you have permission to access the Jira instance

**"Rate limit exceeded" error:**
- Wait a few minutes and try again
- The script automatically adds delays between requests, but Jira has global rate limits

**No issues returned:**
- Verify your JQL query in Jira's web UI first
- Check that you have permission to view the issues
- Use `-v` flag to see detailed logging

## Troubleshooting

### Port already in use
If port 5173 is occupied, Vite will automatically try the next available port. Check the terminal output for the actual URL.

### Dependencies won't install
```bash
# Clear npm cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Build fails
Ensure you're using Node.js 18 or higher:
```bash
node --version
```

### UTF-8 Characters in Data
The app properly handles UTF-8 characters (emojis, special characters) in both JSON and base64 encoding.

## Contributing

When contributing theme definitions or new features:
1. Keep the UI agnostic to specific type/priority names
2. Document theme structure in data examples
3. Test with various SLE step counts (fewer/more than colors)
4. Verify UTF-8 character handling

## License

[Your License Here]