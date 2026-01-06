# Dreamhost Shared Hosting Deployment

## Build Locally

```bash
npm run build
```

This creates `dist/index.html` with all JavaScript and CSS bundled inside.

## Upload to Dreamhost

Upload these files/folders to your domain directory:

```
your-domain.com/
├── index.html          (from dist/index.html)
├── api/
│   ├── chart-data.php
│   └── health.php
└── cli/
    └── get-jira-issues.js
```

## File Structure

- **index.html**: Single-file SPA with all code bundled
- **api/chart-data.php**: Receives Jira config, calls Node.js CLI, returns JSON
- **api/health.php**: Health check endpoint
- **cli/get-jira-issues.js**: Node.js CLI tool (no dependencies needed)

## Apache Configuration

Dreamhost uses Apache by default. Create `.htaccess` in your domain root:

```apache
# Enable rewrite engine
RewriteEngine On

# Serve existing files directly
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# API endpoints go to PHP files
RewriteRule ^api/chart-data$ api/chart-data.php [L]
RewriteRule ^api/health$ api/health.php [L]

# Everything else goes to index.html (SPA routing)
RewriteRule ^ index.html [L]
```

## How It Works

1. User visits your-domain.com → serves `index.html`
2. User navigates to `/config` → SPA routing handles it
3. User clicks "Generate Chart" → POST to `/api/chart-data`
4. PHP receives request → executes `node cli/get-jira-issues.js` with params
5. CLI fetches from Jira, calculates SLEs, outputs JSON
6. PHP returns JSON to browser
7. React displays the chart

## Requirements

- Dreamhost shared hosting account
- Node.js available on server (comes with Dreamhost)
- No npm packages needed (CLI has no dependencies)

## Testing Locally with PHP

If you have PHP installed locally:

```bash
# Build first
npm run build

# Copy built file
cp dist/index.html index.html

# Start PHP dev server
php -S localhost:8000

# Visit http://localhost:8000
```

## Troubleshooting

**CLI not found**: Make sure `cli/get-jira-issues.js` is uploaded and the path in `chart-data.php` is correct.

**Permission denied**: The CLI file might need execute permissions:
```bash
chmod +x cli/get-jira-issues.js
```

**Node not found**: Dreamhost has `node` command. If it's not in PATH, use full path like `/usr/bin/node` in the PHP file.

**API not working**: Check Apache error logs or add error logging to PHP:
```php
error_log("Command: $cmd");
error_log("Output: " . implode("\n", $output));
```
