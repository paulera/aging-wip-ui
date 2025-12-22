# Aging WIP Chart

## Project Overview

This is a Kanban board visualization that displays work items aging over time across different workflow columns. It's designed to help teams identify bottlenecks by showing how long items have been in each stage.

### Key Features

- Aging Visualization: Items are positioned vertically based on their age in days, with color-coded SLE (Service Level Expectation) zones
- Dependency Tracking: Shows arrows between dependent items (e.g., KAN-205 depends on KAN-202)
- Multi-field Filtering: Filter by type, assignee, label, and parent epic
- Data-Driven Configuration: The entire board is configured via JSON data structure

### Technical Stack

- Framework: React 19 with Vite 7
- Styling: Tailwind CSS 4.x
- Icons: Lucide React
- Build: Single-file build output using vite-plugin-singlefile

### Data Flow

The app can load data in two ways:

- URL Parameter: Base64 or URL-encoded JSON via ?data= query parameter (see launch.json)
- Fallback: Mock data hardcoded in App.jsx

The data structure includes:

- Board metadata (title, subtitle, date range)
- Feature flags (dependencies, filters)
- Columns with SLE thresholds and color schemes
- Work items with metadata (type, assignee, labels, parent epic, dependencies)

### Key Components

- App.jsx: Main component with filtering, layout calculation, and rendering logic
- StatusColumn: Renders individual workflow columns with SLE zones
- ItemDot: Interactive work item dots with hover tooltips
- SmartTooltip: Boundary-aware tooltip with item details
- MultiSelect: Custom dropdown filter component
- FilterBar: Filter controls with dependency toggle

### Notable Implementation Details

- Layout uses percentage-based positioning for responsive scaling
- SVG overlay for dependency arrows with dynamic arrowhead positioning
- Data is embedded as HTML comment in built output for portability
- Horizontal scrolling container ensures SVG arrows align with columns even when content overflows

### Build Output

The build process creates a single HTML file (via vite-plugin-singlefile) that's completely self-contained and portable.
