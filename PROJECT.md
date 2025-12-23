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
      "top_text": "WIP: 3",
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
- **name** (string): Column display name
- **top_text** (string): Text shown at top of column (e.g., WIP count)
- **order** (number): Column sort order
- **sle** (object): SLE step thresholds (step1, step2, step3, step4)
  - Colors are pulled from `theme.sle_colors` array
  - If more steps than colors, remaining steps use transparent
  - If more colors than steps, extra colors are unused

#### Items
- **key** (string, required): Unique item identifier
- **title** (string, required): Item title
- **type** (string): Item type (must match a key in `theme.types`)
- **age** (number, required): Age in days
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