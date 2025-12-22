# Aging WIP Visualization

A Kanban board visualization tool that displays work items aging over time across workflow columns. Helps teams identify bottlenecks by showing how long items have been in each stage with color-coded Service Level Expectation (SLE) zones.

## Features

- **Aging Visualization**: Items positioned vertically based on their age in days
- **SLE Zones**: Color-coded zones showing service level expectations
- **Dependency Tracking**: Visual arrows showing dependencies between work items
- **Advanced Filtering**: Filter by type, assignee, label, and parent epic
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
      "fields": ["type", "assignee", "label", "parent"]
    }
  },
  "columns": [
    {
      "style": {
        "name": "Column Name",
        "top_text": "WIP: 3",
        "order": 1,
        "step1_color": "#86efac",
        "step2_color": "#fef08a",
        "step3_color": "#fde047",
        "step4_color": "#fdba74",
        "step5_color": "#fca5a5"
      },
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
          "depends_on": "ITEM-122"
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

#### Features
- **dependencies.enabled** (boolean): Enable/disable dependency arrows
- **dependencies.show_toggle** (boolean): Show toggle button in UI
- **dependencies.default_visible** (boolean): Initial visibility state
- **dependencies.arrow_color** (string): Hex color for arrows
- **dependencies.arrow_thickness** (number): Arrow stroke width
- **filters.enabled** (boolean): Enable/disable filter bar
- **filters.fields** (array): Which fields to filter by (`type`, `assignee`, `label`, `parent`)

#### Columns
- **style.name** (string): Column display name
- **style.top_text** (string): Text shown at top of column (e.g., WIP count)
- **style.order** (number): Column sort order
- **style.step1_color** through **step5_color** (string): Hex colors for SLE zones
- **sle.step1** through **step4** (number): Day thresholds for SLE zones

#### Items
- **key** (string, required): Unique item identifier
- **title** (string, required): Item title
- **type** (string): Item type (`Task`, `Bug`, `Story`)
- **age** (number, required): Age in days
- **assignee.name** (string): Assignee name
- **assignee.picture** (string): URL to profile picture (optional)
- **assignee.link** (string): URL to assignee profile
- **labels** (array): Array of label strings
- **parent.key** (string): Parent epic/feature key
- **parent.title** (string): Parent epic/feature title
- **parent.url** (string): URL to parent item
- **url** (string): URL to the work item
- **depends_on** (string, optional): Key of item this depends on

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
2. **Launch with Team Beta**: Opens with pre-configured sample data

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

## Contributing

See [`PROJECT.md`](PROJECT.md) for architecture details and development guidelines.

## License

[Your License Here]