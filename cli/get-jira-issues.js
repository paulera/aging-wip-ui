#!/usr/bin/env node

/**
 * Jira Issues to Aging WIP JSON Converter
 * 
 * A standalone CLI tool that fetches issues from Jira and transforms them
 * into the JSON format required by the Aging WIP visualization UI.
 * 
 * Usage:
 *   node get-jira-issues.js -j "project = MYPROJ AND status != Done" [-d 2024-01-15] [-t theme.json] [-v|-vv|-vvv]
 * 
 * Environment variables (can be set in .env file):
 *   JIRA_URL - Base URL of your Jira instance
 *   JIRA_USER - Your Jira email
 *   JIRA_API_TOKEN - Your Jira API token
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL, fileURLToPath } from 'url';
import { parseArgs } from 'util';

// ES Module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration & Constants
// ============================================================================

const DEFAULT_THEME = {
  "theme_name": "CLI theme",
  "theme_author_name": "Paulo Amaral",
  "theme_author_email": "paulo.amaral@gmail.com",
  "sle_colors": ["#86efac", "#fef08a", "#fde047", "#fdba74", "#fca5a5"],
  "types": {
    "Task": { "color": "#3b82f6", "borderColor": "#2563eb", "borderWidth": 1, "icon": "TA" },
    "Bug": { "color": "#ef4444", "borderColor": "#dc2626", "borderWidth": 2, "icon": "BU" },
    "Story": { "color": "#10b981", "borderColor": "#059669", "borderWidth": 11, "icon": "US" }
  },
  "priorities": {
    "Highest": "🔴",
    "High": "🟠",
    "Medium": "🟡",
    "Low": "🟢",
    "Lowest": "🔵"
  }
};

const RATE_LIMIT_DELAY = 100; // ms between requests
const MAX_RESULTS_PER_PAGE = 100;

// ============================================================================
// Logging Utilities
// ============================================================================

let VERBOSITY = 0; // 0 = silent, 1 = verbose, 2 = debug, 3 = trace

function log(message, level = 1) {
  if (VERBOSITY >= level) {
    console.error(`[${new Date().toISOString()}] ${message}`);
  }
}

function verbose(message) { log(message, 1); }
function debug(message) { log(message, 2); }
function trace(message) { log(message, 3); }

// ============================================================================
// Environment & Configuration Loading
// ============================================================================

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  debug(`Loading .env file from: ${envPath}`);
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
  
  return env;
}

function getConfig() {
  const envFile = loadEnvFile();
  
  // .env file overrides environment variables
  const config = {
    JIRA_URL: envFile.JIRA_URL || process.env.JIRA_URL,
    JIRA_USER: envFile.JIRA_USER || process.env.JIRA_USER,
    JIRA_API_TOKEN: envFile.JIRA_API_TOKEN || process.env.JIRA_API_TOKEN
  };

  // Validate required config
  const missing = [];
  if (!config.JIRA_URL) missing.push('JIRA_URL');
  if (!config.JIRA_USER) missing.push('JIRA_USER');
  if (!config.JIRA_API_TOKEN) missing.push('JIRA_API_TOKEN');

  if (missing.length > 0) {
    console.error(`Error: Missing required configuration: ${missing.join(', ')}`);
    console.error('Set these as environment variables or in a .env file');
    process.exit(1);
  }

  // Remove trailing slash from URL
  config.JIRA_URL = config.JIRA_URL.replace(/\/$/, '');

  debug(`Configuration loaded: JIRA_URL=${config.JIRA_URL}, JIRA_USER=${config.JIRA_USER}`);
  return config;
}

// ============================================================================
// HTTP Request Utilities
// ============================================================================

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    trace(`HTTP ${requestOptions.method} ${url}`);

    const req = lib.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        trace(`HTTP ${res.statusCode} - ${data.length} bytes received`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON response: ${e.message}`));
          }
        } else if (res.statusCode === 429) {
          reject(new Error('Rate limit exceeded. Please try again later.'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Jira API Client
// ============================================================================

class JiraClient {
  constructor(config) {
    this.baseUrl = config.JIRA_URL;
    this.authHeader = 'Basic ' + Buffer.from(`${config.JIRA_USER}:${config.JIRA_API_TOKEN}`).toString('base64');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': this.authHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    await sleep(RATE_LIMIT_DELAY); // Rate limiting
    return makeRequest(url, { ...options, headers });
  }

  async searchIssues(jql, startAt = 0) {
    const fields = [
      'key',
      'summary',
      'issuetype',
      'status',
      'priority',
      'assignee',
      'labels',
      'parent',
      'created',
      'issuelinks',
      'customfield_*' // We'll filter relevant custom fields later
    ];

    const endpoint = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${MAX_RESULTS_PER_PAGE}&fields=${fields.join(',')}&expand=changelog`;
    
    verbose(`Fetching issues: startAt=${startAt}, maxResults=${MAX_RESULTS_PER_PAGE}`);
    return this.request(endpoint);
  }

  async getAllIssues(jql) {
    let allIssues = [];
    let startAt = 0;
    let total = null;

    do {
      const response = await this.searchIssues(jql, startAt);
      allIssues = allIssues.concat(response.issues);
      
      if (total === null) {
        total = response.total;
        verbose(`Total issues to fetch: ${total}`);
      }

      startAt += response.issues.length;
      verbose(`Fetched ${allIssues.length}/${total} issues`);

    } while (allIssues.length < total);

    verbose(`Successfully fetched all ${allIssues.length} issues`);
    return allIssues;
  }

  async getStatusesByIds(statusIds) {
    if (statusIds.length === 0) {
      return [];
    }
    
    const idsParam = statusIds.map(id => `id=${id}`).join('&');
    verbose(`Fetching status metadata for ${statusIds.length} statuses...`);
    const statuses = await this.request(`/rest/api/3/statuses?${idsParam}`);
    verbose(`Fetched ${statuses.length} status definitions`);
    return statuses;
  }
}

// ============================================================================
// Data Transformation
// ============================================================================

function calculateAge(createdDate, referenceDate) {
  const created = new Date(createdDate);
  const reference = new Date(referenceDate);
  const diffMs = reference - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays); // Never negative
}

function buildStatusCategoryMap(statuses) {
  const map = new Map();
  statuses.forEach(status => {
    if (status.statusCategory) {
      map.set(status.id, status.statusCategory.key);
      // Also map by name for current status lookup
      map.set(status.name, status.statusCategory.key);
    }
  });
  debug(`Built status category map with ${map.size} entries`);
  return map;
}

function extractUniqueStatusIds(issues) {
  const statusIds = new Set();
  
  issues.forEach(issue => {
    // Add current status ID
    if (issue.fields.status?.id) {
      statusIds.add(issue.fields.status.id);
    }
    
    // Add all status IDs from changelog
    if (issue.changelog?.histories) {
      issue.changelog.histories.forEach(history => {
        history.items.forEach(item => {
          if (item.field === 'status') {
            if (item.from) statusIds.add(item.from);
            if (item.to) statusIds.add(item.to);
          }
        });
      });
    }
  });
  
  const ids = Array.from(statusIds);
  debug(`Extracted ${ids.length} unique status IDs from issues`);
  return ids;
}

function findFirstStableExitFromTodo(changelog, statusCategoryMap) {
  if (!changelog || !changelog.histories) {
    return null;
  }

  // Sort histories chronologically (oldest first)
  const histories = [...changelog.histories].reverse();
  
  let firstExitDate = null;
  
  for (let i = 0; i < histories.length; i++) {
    const history = histories[i];
    const statusChange = history.items.find(item => item.field === 'status');
    
    if (statusChange) {
      const fromCategory = statusCategoryMap.get(statusChange.from);
      const toCategory = statusCategoryMap.get(statusChange.to);
      const changeDate = new Date(history.created);
      
      // Found a transition OUT of TODO category
      if (fromCategory === 'new' && toCategory !== 'new') {
        debug(`  Found exit from TODO: ${statusChange.fromString} → ${statusChange.toString} on ${history.created}`);
        
        // Check if there's a same-day return to TODO
        let sameDayReturnToTodo = false;
        
        for (let j = i + 1; j < histories.length; j++) {
          const nextHistory = histories[j];
          const nextStatusChange = nextHistory.items.find(item => item.field === 'status');
          
          if (nextStatusChange) {
            const nextDate = new Date(nextHistory.created);
            const nextToCategory = statusCategoryMap.get(nextStatusChange.to);
            
            // Check if it's the same day
            if (nextDate.toDateString() === changeDate.toDateString()) {
              // Check if returning to TODO
              if (nextToCategory === 'new') {
                debug(`    Same-day return to TODO found, ignoring this exit`);
                sameDayReturnToTodo = true;
                break;
              }
            } else {
              // Different day, stop checking
              break;
            }
          }
        }
        
        // If no same-day return, this is our stable exit
        if (!sameDayReturnToTodo) {
          firstExitDate = history.created;
          debug(`  Using this as stable exit date: ${firstExitDate}`);
          break;
        }
      }
    }
  }
  
  return firstExitDate;
}

function findMostRecentTransitionToStatus(changelog, currentStatusId) {
  if (!changelog || !changelog.histories) {
    return null;
  }

  // Histories are typically in reverse chronological order, search from start
  for (const history of changelog.histories) {
    const statusChange = history.items.find(item => item.field === 'status');
    if (statusChange && statusChange.to === currentStatusId) {
      debug(`  Found most recent transition to current status on ${history.created}`);
      return history.created;
    }
  }
  
  return null;
}

function calculateAgeMetrics(issue, referenceDate, statusCategoryMap) {
  const currentStatus = issue.fields.status.name;
  const currentStatusId = issue.fields.status.id;
  const currentCategory = issue.fields.status.statusCategory?.key;
  const createdDate = issue.fields.created;
  
  debug(`Calculating age for ${issue.key} (status: ${currentStatus}, category: ${currentCategory})`);
  
  // Find first stable exit from TODO category
  const firstStableExit = findFirstStableExitFromTodo(issue.changelog, statusCategoryMap);
  
  // Find most recent transition to current status
  const mostRecentTransition = findMostRecentTransitionToStatus(issue.changelog, currentStatusId);
  
  // Calculate ages
  const ageStartDate = firstStableExit || createdDate;
  const currentStateStartDate = mostRecentTransition || createdDate;
  
  const totalAge = calculateAge(ageStartDate, referenceDate);
  const currentStateAge = calculateAge(currentStateStartDate, referenceDate);
  
  debug(`  Total age: ${totalAge} days (since ${ageStartDate})`);
  debug(`  Current state age: ${currentStateAge} days (since ${currentStateStartDate})`);
  
  return {
    age: totalAge,
    age_in_current_state: currentStateAge
  };
}

function extractDependencies(issue) {
  // Extract "blocks" and "is blocked by" relationships
  const links = issue.fields.issuelinks || [];
  const blockedBy = [];

  links.forEach(link => {
    if (link.type.name === 'Blocks' && link.inwardIssue) {
      blockedBy.push(link.inwardIssue.key);
    }
  });

  return blockedBy.length > 0 ? blockedBy[0] : null; // Return first dependency
}

function transformIssue(issue, referenceDate, jiraBaseUrl, statusCategoryMap) {
  const fields = issue.fields;
  
  // Extract numeric part from key (e.g., "PROJ-123" -> "123")
  const nickname = issue.key.split('-')[1];
  
  // Calculate age metrics using changelog
  const ageMetrics = calculateAgeMetrics(issue, referenceDate, statusCategoryMap);
  
  return {
    key: issue.key,
    title: fields.summary,
    type: fields.issuetype?.name || 'Unknown',
    age: ageMetrics.age,
    age_in_current_state: ageMetrics.age_in_current_state,
    priority: fields.priority?.name || 'Medium',
    assignee: {
      name: fields.assignee?.displayName || 'Unassigned',
      picture: fields.assignee?.avatarUrls?.['48x48'] || '',
      link: fields.assignee?.self || '#'
    },
    labels: fields.labels || [],
    parent: fields.parent ? {
      key: fields.parent.key,
      title: fields.parent.fields.summary,
      url: `${jiraBaseUrl}/browse/${fields.parent.key}`
    } : null,
    url: `${jiraBaseUrl}/browse/${issue.key}`,
    depends_on: extractDependencies(issue),
    nickname: nickname
  };
}

function groupByStatus(issues) {
  const groups = new Map();
  
  issues.forEach(issue => {
    const status = issue.status;
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status).push(issue);
  });

  return groups;
}

function createColumns(issuesByStatus) {
  const columns = [];
  let order = 1;

  issuesByStatus.forEach((issues, statusName) => {
    columns.push({
      name: statusName,
      top_text: `WIP: ${issues.length}`,
      order: order++,
      sle: { step1: 10, step2: 10, step3: 10, step4: 10 }, // Simplified SLE
      items: issues.map(issue => {
        // Remove status from issue object
        const { status, ...itemData } = issue;
        return itemData;
      })
    });
  });

  return columns;
}

function autoDetectThemeTypes(issues, baseTheme) {
  const types = { ...baseTheme.types };
  const detectedTypes = new Set(issues.map(i => i.type));

  // Generate colors for new types
  const defaultColors = [
    { color: "#8b5cf6", borderColor: "#7c3aed", borderWidth: 2, icon: "TY" },
    { color: "#ec4899", borderColor: "#db2777", borderWidth: 2, icon: "TY" },
    { color: "#f59e0b", borderColor: "#d97706", borderWidth: 2, icon: "TY" },
    { color: "#14b8a6", borderColor: "#0d9488", borderWidth: 2, icon: "TY" },
  ];

  let colorIndex = 0;
  detectedTypes.forEach(typeName => {
    if (!types[typeName]) {
      const colorDef = defaultColors[colorIndex % defaultColors.length];
      types[typeName] = {
        ...colorDef,
        icon: typeName.substring(0, 2).toUpperCase()
      };
      debug(`Auto-detected new type: ${typeName}`);
      colorIndex++;
    }
  });

  return types;
}

function autoDetectThemePriorities(issues, baseTheme) {
  const priorities = { ...baseTheme.priorities };
  const detectedPriorities = new Set(issues.map(i => i.priority));

  detectedPriorities.forEach(priorityName => {
    if (!priorities[priorityName]) {
      priorities[priorityName] = '⚫'; // Default icon
      debug(`Auto-detected new priority: ${priorityName}`);
    }
  });

  return priorities;
}

function buildOutput(issues, referenceDate, jiraBaseUrl, theme, statusCategoryMap, columnsOrder = null) {
  // Transform issues
  const transformedIssues = issues.map(issue => {
    const transformed = transformIssue(issue, referenceDate, jiraBaseUrl, statusCategoryMap);
    transformed.status = issue.fields.status.name; // Temporarily add status for grouping
    return transformed;
  });

  // Group by status
  const issuesByStatus = groupByStatus(transformedIssues);
  
  // Create columns
  let columns = createColumns(issuesByStatus);

  // Apply custom column order if provided
  if (columnsOrder) {
    const orderArray = columnsOrder.split(',').map(name => name.trim());
    debug(`Applying custom column order: ${orderArray.join(', ')}`);
    
    // Create a map for quick lookup
    const orderMap = new Map(orderArray.map((name, index) => [name, index]));
    
    // Sort columns based on provided order, keeping unlisted columns at the end
    columns.sort((a, b) => {
      const orderA = orderMap.has(a.name) ? orderMap.get(a.name) : 9999;
      const orderB = orderMap.has(b.name) ? orderMap.get(b.name) : 9999;
      return orderA - orderB;
    });
    
    // Update order property
    columns.forEach((col, index) => {
      col.order = index + 1;
    });
  }

  // Auto-detect types and priorities
  const allItems = columns.flatMap(col => col.items);
  const finalTheme = {
    ...theme,
    types: autoDetectThemeTypes(allItems, theme),
    priorities: autoDetectThemePriorities(allItems, theme)
  };

  // Calculate max age
  const allAges = allItems.map(item => item.age);
  const maxAge = Math.max(...allAges, 30); // At least 30 days

  return {
    title: "Jira Issues - Aging WIP",
    subtitle: `As of ${referenceDate}`,
    board_url: jiraBaseUrl,
    min_days: 0,
    max_days: maxAge,
    theme: finalTheme,
    features: {
      dependencies: {
        enabled: true,
        show_toggle: true,
        default_visible: true,
        arrow_color: "#303030",
        arrow_thickness: 2
      },
      filters: {
        enabled: true,
        fields: ["type", "assignee", "label", "parent", "priority"]
      }
    },
    columns: columns
  };
}

// ============================================================================
// CLI Argument Parsing (using Node 18+ parseArgs)
// ============================================================================

function parseCLIArgs() {
  const options = {
    jql: {
      type: 'string',
      short: 'j',
    },
    date: {
      type: 'string',
      short: 'd',
      default: new Date().toISOString().split('T')[0]
    },
    theme: {
      type: 'string',
      short: 't',
    },
    'columns-order': {
      type: 'string',
      short: 'o',
    },
    verbose: {
      type: 'boolean',
      short: 'v',
      default: false
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false
    }
  };

  let parsed;
  try {
    parsed = parseArgs({ options, allowPositionals: false, strict: true });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    printHelp();
    process.exit(1);
  }

  const values = parsed.values;

  // Handle help
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // Handle verbosity levels
  let verbosity = 0;
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('-vvv') || rawArgs.includes('--trace')) {
    verbosity = 3;
  } else if (rawArgs.includes('-vv') || rawArgs.includes('--debug')) {
    verbosity = 2;
  } else if (values.verbose) {
    verbosity = 1;
  }

  // Validate required
  if (!values.jql) {
    console.error('Error: JQL query is required (-j or --jql)');
    printHelp();
    process.exit(1);
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    console.error('Error: Date must be in YYYY-MM-DD format');
    process.exit(1);
  }

  return {
    jql: values.jql,
    date: values.date,
    theme: values.theme || null,
    columnsOrder: values['columns-order'] || null,
    verbosity: verbosity
  };
}

function printHelp() {
  console.error(`
Usage: node get-jira-issues.js -j JQL [options]

Required:
  -j, --jql <query>       JQL query to fetch issues

Options:
  -d, --date <YYYY-MM-DD>    Reference date for age calculation (default: today)
  -t, --theme <path>         Path to theme JSON file (default: built-in theme)
  -co, --columns-order <col1,col2,...>
                             Comma-separated list of column names to define order
  -v, --verbose              Verbose logging
  -vv, --debug            Debug logging (includes verbose)
  -vvv, --trace           Trace logging (includes debug + verbose)
  -h, --help              Show this help message

Environment variables (or .env file):
  JIRA_URL                Jira base URL (e.g., https://company.atlassian.net)
  JIRA_USER               Jira email address
  JIRA_API_TOKEN          Jira API token

Examples:
  node get-jira-issues.js -j "project = MYPROJ AND status != Done"
  node get-jira-issues.js -j "assignee = currentUser()" -d 2024-01-15 -v
  node get-jira-issues.js -j "filter = 12345" -t custom-theme.json -vv
  `);
}

// ============================================================================
// Theme Loading
// ============================================================================

function loadTheme(themePath) {
  if (!themePath) {
    debug('Using default theme');
    return DEFAULT_THEME;
  }

  if (!fs.existsSync(themePath)) {
    console.error(`Error: Theme file not found: ${themePath}`);
    process.exit(1);
  }

  try {
    debug(`Loading theme from: ${themePath}`);
    const content = fs.readFileSync(themePath, 'utf-8');
    const theme = JSON.parse(content);
    
    // Merge with defaults to ensure all required fields exist
    return {
      theme_name: theme.theme_name || DEFAULT_THEME.theme_name,
      theme_author_name: theme.theme_author_name || DEFAULT_THEME.theme_author_name,
      theme_author_email: theme.theme_author_email || DEFAULT_THEME.theme_author_email,
      sle_colors: theme.sle_colors || DEFAULT_THEME.sle_colors,
      types: theme.types || DEFAULT_THEME.types,
      priorities: theme.priorities || DEFAULT_THEME.priorities
    };
  } catch (e) {
    console.error(`Error: Failed to parse theme file: ${e.message}`);
    process.exit(1);
  }
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  const args = parseCLIArgs();
  VERBOSITY = args.verbosity;

  verbose('='.repeat(80));
  verbose('Jira Issues to Aging WIP JSON Converter');
  verbose('='.repeat(80));

  // Load configuration
  const config = getConfig();
  const theme = loadTheme(args.theme);

  // Create Jira client
  const jira = new JiraClient(config);

  try {
    // Fetch all issues first
    verbose(`Executing JQL: ${args.jql}`);
    const issues = await jira.getAllIssues(args.jql);

    if (issues.length === 0) {
      verbose('No issues found matching the JQL query');
      console.log(JSON.stringify({ columns: [] }, null, 2));
      return;
    }

    // Extract unique status IDs from issues
    const statusIds = extractUniqueStatusIds(issues);
    
    // Fetch status metadata in bulk
    const statuses = await jira.getStatusesByIds(statusIds);
    const statusCategoryMap = buildStatusCategoryMap(statuses);
    
    // Transform to output format
    verbose('Transforming issues to output format...');
    const output = buildOutput(issues, args.date, config.JIRA_URL, theme, statusCategoryMap, args.columnsOrder);

    // Output JSON to stdout
    console.log(JSON.stringify(output, null, 2));

    verbose('='.repeat(80));
    verbose('Success! JSON output written to stdout');
    verbose(`Total issues: ${issues.length}`);
    verbose(`Total columns: ${output.columns.length}`);
    verbose('='.repeat(80));

  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (VERBOSITY >= 2) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});