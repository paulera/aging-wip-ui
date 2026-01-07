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
    "Story": { "color": "#10b981", "borderColor": "#059669", "borderWidth": 4, "icon": "US" }
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
    
    // The search API returns incomplete changelogs. Fetch complete changelogs for non-done issues.
    // We only need complete changelogs for active issues that will be displayed on the board.
    const activeIssues = allIssues.filter(issue => {
      const statusCategory = issue.fields.status?.statusCategory?.key;
      return statusCategory !== 'done';
    });
    
    if (activeIssues.length > 0) {
      verbose(`Fetching complete changelogs for ${activeIssues.length} active issues (skipping ${allIssues.length - activeIssues.length} done issues)...`);
      
      // Process in batches of 10 concurrent requests for better performance
      const batchSize = 10;
      for (let i = 0; i < activeIssues.length; i += batchSize) {
        const batch = activeIssues.slice(i, Math.min(i + batchSize, activeIssues.length));
        await Promise.all(batch.map(async (issue) => {
          try {
            const fullIssue = await this.request(`/rest/api/3/issue/${issue.key}?expand=changelog&fields=changelog`);
            if (fullIssue.changelog) {
              issue.changelog = fullIssue.changelog;
              debug(`  Enriched changelog for ${issue.key}: ${fullIssue.changelog.total} history entries`);
            }
          } catch (error) {
            verbose(`  Warning: Could not fetch complete changelog for ${issue.key}: ${error.message}`);
          }
        }));
      }
      verbose(`Completed changelog enrichment`);
    } else {
      verbose(`No active issues require changelog enrichment`);
    }
    
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
  // ProKanban best practice: work is "Day 1" from the moment it starts
  // No such thing as "zero days old" - work incurs cost from day one
  return Math.max(1, diffDays + 1);
}

function formatDate(isoDateString) {
  const date = new Date(isoDateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

function buildStatusCategoryMap(statuses) {
  const map = new Map();
  
  // Map status category strings to standard Jira keys
  // The /rest/api/3/statuses endpoint returns statusCategory as a string
  const categoryStringToKey = {
    'TODO': 'new',
    'IN_PROGRESS': 'indeterminate',
    'DONE': 'done'
  };
  
  statuses.forEach(status => {
    if (status.statusCategory) {
      let categoryKey;
      
      // Handle both API response formats:
      // 1. /rest/api/3/statuses returns statusCategory as string: "TODO", "IN_PROGRESS", "DONE"
      // 2. /rest/api/3/status/{id} returns statusCategory as object with .key property
      if (typeof status.statusCategory === 'string') {
        categoryKey = categoryStringToKey[status.statusCategory] || status.statusCategory.toLowerCase();
      } else if (status.statusCategory.key) {
        categoryKey = status.statusCategory.key;
      }
      
      if (categoryKey) {
        map.set(status.id, categoryKey);
        // Also map by name for current status lookup
        map.set(status.name, categoryKey);
      }
    }
  });
  debug(`Built status category map with ${map.size} entries`);
  return map;
}

function buildStatusNameToIdMap(statuses) {
  const map = new Map();
  statuses.forEach(status => {
    map.set(status.name, status.id);
  });
  return map;
}

function extractUniqueStatusIds(issues) {
  const statusIds = new Set();
  
  issues.forEach(issue => {
    // Add current status ID
    if (issue.fields.status && issue.fields.status.id) {
      statusIds.add(issue.fields.status.id);
    }
    
    // Add all status IDs from changelog
    if (issue.changelog && issue.changelog.histories) {
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
  const currentCategory = issue.fields.status.statusCategory ? issue.fields.status.statusCategory.key : null;
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
    age_in_current_state: currentStateAge,
    start_date: formatDate(ageStartDate),
    current_state_start_date: formatDate(currentStateStartDate)
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
    type: (fields.issuetype && fields.issuetype.name) || 'Unknown',
    age: ageMetrics.age,
    age_in_current_state: ageMetrics.age_in_current_state,
    start_date: ageMetrics.start_date,
    current_state_start_date: ageMetrics.current_state_start_date,
    priority: (fields.priority && fields.priority.name) || 'Medium',
    assignee: {
      name: (fields.assignee && fields.assignee.displayName) || 'Unassigned',
      picture: (fields.assignee && fields.assignee.avatarUrls && fields.assignee.avatarUrls['48x48']) || '',
      link: (fields.assignee && fields.assignee.self) || '#'
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

function parseWindow(windowStr, referenceDate) {
  // Parse window format: "Xd", "YYYY-MM-DD", "YYYYMMDD", or integer
  
  // Check for "Xd" format
  const daysMatch = windowStr.match(/^(\d+)d$/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    debug(`Window: ${days} days before ${referenceDate} = ${cutoffDate.toISOString().split('T')[0]}`);
    return { type: 'date', value: cutoffDate.toISOString().split('T')[0] };
  }
  
  // Check for date format YYYY-MM-DD or YYYYMMDD
  const dateMatch = windowStr.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (dateMatch) {
    const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    debug(`Window: From date ${dateStr}`);
    return { type: 'date', value: dateStr };
  }
  
  // Check for integer count
  const countMatch = windowStr.match(/^(\d+)$/);
  if (countMatch) {
    const count = parseInt(countMatch[1]);
    debug(`Window: Latest ${count} transitions`);
    return { type: 'count', value: count };
  }
  
  throw new Error(`Invalid window format: ${windowStr}. Use Xd, YYYY-MM-DD, YYYYMMDD, or integer.`);
}

function extractStatusTransitions(issues, statusCategoryMap) {
  const transitionsByStatusId = new Map(); // statusId -> [overallAges]
  
  trace(`Extracting status transitions from ${issues.length} issues...`);
  
  issues.forEach(issue => {
    if (!issue.changelog || !issue.changelog.histories) {
      return;
    }
    
    // First, find when this issue first exited TODO status category
    const firstExitFromTodo = findFirstStableExitFromTodo(issue.changelog, statusCategoryMap);
    const baseDate = firstExitFromTodo ? new Date(firstExitFromTodo) : new Date(issue.fields.created);
    
    // Sort histories chronologically (oldest first)
    const histories = [...issue.changelog.histories].reverse();
    
    let currentStatusId = null;
    
    histories.forEach(history => {
      const statusChange = history.items.find(item => item.field === 'status');
      
      if (statusChange) {
        const fromStatusId = statusChange.from;
        const toStatusId = statusChange.to;
        const exitDate = new Date(history.created);
        
        // If we have a current status being tracked, record its exit
        if (currentStatusId && fromStatusId === currentStatusId) {
          // Calculate overall age at exit using ProKanban Day 1 standard
          const overallAgeMs = exitDate - baseDate;
          const overallAgeDays = Math.floor(overallAgeMs / (1000 * 60 * 60 * 24));
          // ProKanban: work is "Day 1" from the moment it starts
          const overallAge = Math.max(1, overallAgeDays + 1);
          
          if (!transitionsByStatusId.has(currentStatusId)) {
            transitionsByStatusId.set(currentStatusId, []);
          }
          
          transitionsByStatusId.get(currentStatusId).push({
            issueKey: issue.key,
            exitDate: history.created.split('T')[0],
            overallAge: overallAge
          });
          
          trace(`  ${issue.key}: Status ${currentStatusId} exited at overall age ${overallAge} days`);
        }
        
        // Update current status tracking
        currentStatusId = toStatusId;
      }
    });
  });
  
  debug(`Extracted transitions for ${transitionsByStatusId.size} unique statuses`);
  return transitionsByStatusId;
}

function filterTransitionsByWindow(transitions, window) {
  if (window.type === 'date') {
    const cutoffDate = window.value;
    return transitions.filter(t => t.exitDate >= cutoffDate);
  } else if (window.type === 'count') {
    // Sort by exit date descending, take latest N
    const sorted = [...transitions].sort((a, b) => b.exitDate.localeCompare(a.exitDate));
    return sorted.slice(0, window.value);
  }
  return transitions;
}

function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function calculateSLEsForStatuses(transitionsByStatusId, window, percentiles) {
  const slesByStatusId = new Map();
  
  verbose(`Calculating SLEs for ${transitionsByStatusId.size} statuses...`);
  
  transitionsByStatusId.forEach((transitions, statusId) => {
    // Filter by window
    const filtered = filterTransitionsByWindow(transitions, window);
    
    if (filtered.length === 0) {
      debug(`  Status ${statusId}: No transitions in window`);
      return;
    }
    
    // Extract overall ages and sort
    const overallAges = filtered.map(t => t.overallAge).sort((a, b) => a - b);
    
    // Calculate percentiles
    const sles = percentiles.map(p => Math.ceil(calculatePercentile(overallAges, p)));
    
    slesByStatusId.set(statusId, sles);
    
    debug(`  Status ${statusId}: ${filtered.length} transitions, SLEs: [${sles.join(', ')}]`);
    trace(`    Sample overall ages: [${overallAges.slice(0, Math.min(10, overallAges.length)).join(', ')}...]`);
  });
  
  verbose(`Calculated SLEs for ${slesByStatusId.size} statuses`);
  return slesByStatusId;
}

function createColumns(issuesByStatus, slesByStatusId = null, statusIdMap = null) {
  const columns = [];
  let order = 1;

  issuesByStatus.forEach((issues, statusName) => {
    // Get status ID for SLE lookup
    const statusId = statusIdMap ? statusIdMap.get(statusName) : null;
    const sles = (statusId && slesByStatusId) ? slesByStatusId.get(statusId) : null;
    
    columns.push({
      name: statusName,
      top_text: `WIP: ${issues.length}`,
      order: order++,
      sle: sles || null, // Array of SLE values or null if not calculated
      items: issues.map(issue => {
        // Remove status from issue object
        const { status, statusId: _, ...itemData } = issue;
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

function buildOutput(issues, referenceDate, jiraBaseUrl, theme, statusCategoryMap, slesByStatusId = null, columnsOrder = null, maxDaysOverride = null, allStatusNameToIdMap = null) {
  // Transform issues
  const transformedIssues = issues.map(issue => {
    const transformed = transformIssue(issue, referenceDate, jiraBaseUrl, statusCategoryMap);
    transformed.status = issue.fields.status.name; // Temporarily add status for grouping
    transformed.statusId = issue.fields.status.id; // For SLE matching
    return transformed;
  });

  // Group by status
  const issuesByStatus = groupByStatus(transformedIssues);
  
  // Build status name -> ID map from current issues
  const statusIdMap = new Map();
  transformedIssues.forEach(issue => {
    if (!statusIdMap.has(issue.status)) {
      statusIdMap.set(issue.status, issue.statusId);
    }
  });
  
  // If we have allStatusNameToIdMap, merge it (prioritize current issues)
  if (allStatusNameToIdMap) {
    allStatusNameToIdMap.forEach((id, name) => {
      if (!statusIdMap.has(name)) {
        statusIdMap.set(name, id);
      }
    });
  }
  
  // Create columns with SLE data
  let columns = createColumns(issuesByStatus, slesByStatusId, statusIdMap);

  // Apply custom column order if provided
  if (columnsOrder) {
    const orderArray = columnsOrder.split(',').map(name => name.trim());
    debug(`Applying custom column order: ${orderArray.join(', ')}`);
    
    // Create a map for quick lookup
    const orderMap = new Map(orderArray.map((name, index) => [name, index]));
    
    // Add missing columns from orderArray that don't exist yet
    orderArray.forEach(statusName => {
      if (!columns.find(col => col.name === statusName)) {
        const statusId = statusIdMap.get(statusName);
        const sles = (statusId && slesByStatusId) ? slesByStatusId.get(statusId) : null;
        debug(`Creating empty column for: ${statusName}${statusId ? ` (ID: ${statusId})` : ''}`);
        columns.push({
          name: statusName,
          top_text: `WIP: 0`,
          order: 9999, // Will be updated below
          sle: sles || null,
          items: []
        });
      }
    });
    
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
  const calculatedMaxAge = Math.max(...allAges, 30); // At least 30 days
  
  // Round up to next multiple of 10
  const calculatedYAxisMax = Math.ceil(calculatedMaxAge / 10) * 10;
  
  const maxAge = maxDaysOverride !== null ? maxDaysOverride : calculatedYAxisMax;
  
  if (maxDaysOverride !== null) {
    debug(`Using custom max_days: ${maxAge} (calculated: ${calculatedYAxisMax})`);
  }

  return {
    title: "Jira Issues - Aging WIP",
    subtitle: `As of ${formatDate(referenceDate)}`,
    reference_date: formatDate(referenceDate),
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
// CLI Argument Parsing (Node 12+ compatible)
// ============================================================================

function parseCLIArgs() {
  const args = process.argv.slice(2);
  const values = {
    jql: null,
    date: new Date().toISOString().split('T')[0],
    theme: null,
    'columns-order': null,
    'max-days': null,
    percentiles: '50,75,85,90',
    'sle-window': '90d',
    'sle-jql': null,
    verbose: false,
    help: false
  };

  // Parse arguments manually
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      values.help = true;
    } else if (arg === '-v' || arg === '--verbose') {
      values.verbose = true;
    } else if (arg === '-vv' || arg === '--debug') {
      values.verbose = 'debug';
    } else if (arg === '-vvv' || arg === '--trace') {
      values.verbose = 'trace';
    } else if ((arg === '-j' || arg === '--jql') && i + 1 < args.length) {
      values.jql = args[++i];
    } else if ((arg === '-d' || arg === '--date') && i + 1 < args.length) {
      values.date = args[++i];
    } else if ((arg === '-t' || arg === '--theme') && i + 1 < args.length) {
      values.theme = args[++i];
    } else if ((arg === '-o' || arg === '--columns-order') && i + 1 < args.length) {
      values['columns-order'] = args[++i];
    } else if ((arg === '-m' || arg === '--max-days') && i + 1 < args.length) {
      values['max-days'] = args[++i];
    } else if ((arg === '-p' || arg === '--percentiles') && i + 1 < args.length) {
      values.percentiles = args[++i];
    } else if ((arg === '-w' || arg === '--sle-window') && i + 1 < args.length) {
      values['sle-window'] = args[++i];
    } else if ((arg === '-s' || arg === '--sle-jql') && i + 1 < args.length) {
      values['sle-jql'] = args[++i];
    } else if (!arg.startsWith('-')) {
      console.error(`Error: Unknown positional argument: ${arg}`);
      printHelp();
      process.exit(1);
    } else {
      console.error(`Error: Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  // Handle help
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // Handle verbosity levels
  let verbosity = 0;
  if (values.verbose === 'trace') {
    verbosity = 3;
  } else if (values.verbose === 'debug') {
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
    maxDays: values['max-days'] ? parseInt(values['max-days']) : null,
    percentiles: values.percentiles.split(',').map(p => parseInt(p.trim())),
    sleWindow: values['sle-window'],
    sleJql: values['sle-jql'] || null,
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
  -o, --columns-order <col1,col2,...>
                             Comma-separated list of column names to define order
  -m, --max-days <days>      Maximum days for chart scale (default: auto-calculated from oldest issue)
  -p, --percentiles <list>   Comma-separated percentiles for SLE (default: 50,75,85,90)
  -w, --sle-window <window>  Window for SLE calculation: Xd, YYYY-MM-DD, or count (default: 90d)
  -s, --sle-jql <query>      JQL query for historical data to calculate SLEs
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
    const allStatusNameToIdMap = buildStatusNameToIdMap(statuses);
    
    // Calculate SLEs if sle-jql is provided
    let slesByStatusId = null;
    if (args.sleJql) {
      verbose('='.repeat(80));
      verbose('Calculating SLEs from historical data...');
      verbose('='.repeat(80));
      
      // Fetch historical issues for SLE calculation
      verbose(`Executing SLE JQL: ${args.sleJql}`);
      const sleIssues = await jira.getAllIssues(args.sleJql);
      verbose(`Fetched ${sleIssues.length} issues for SLE calculation`);
      
      if (sleIssues.length > 0) {
        // Extract status transitions
        const transitionsByStatusId = extractStatusTransitions(sleIssues, statusCategoryMap);
        
        // Parse window
        const window = parseWindow(args.sleWindow, args.date);
        
        // Calculate SLEs
        slesByStatusId = calculateSLEsForStatuses(transitionsByStatusId, window, args.percentiles);
        
        verbose(`SLE calculation complete for percentiles: [${args.percentiles.join(', ')}]`);
      } else {
        verbose('No historical issues found for SLE calculation');
      }
      
      verbose('='.repeat(80));
    } else {
      debug('No --sle-jql provided, skipping SLE calculation');
    }
    
    // Transform to output format
    verbose('Transforming issues to output format...');
    const output = buildOutput(issues, args.date, config.JIRA_URL, theme, statusCategoryMap, slesByStatusId, args.columnsOrder, args.maxDays, allStatusNameToIdMap);

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

// Export functions for library usage
export {
  JiraClient,
  buildOutput,
  extractUniqueStatusIds,
  buildStatusCategoryMap,
  buildStatusNameToIdMap,
  extractStatusTransitions,
  calculateSLEsForStatuses,
  parseWindow,
  DEFAULT_THEME,
  VERBOSITY
};

// Only run main() if executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check if running as API server
  const args = process.argv.slice(2);
  if (args.includes('--server')) {
    startServer();
  } else {
    main().catch(error => {
      console.error(`Fatal error: ${error.message}`);
      process.exit(1);
    });
  }
}

// ============================================================================
// API Server Mode
// ============================================================================

function startServer() {
  const PORT = process.env.PORT || 3001;
  
  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Health check
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    
    // Generate chart endpoint
    if (req.url === '/generate-chart' && req.method === 'POST') {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const params = JSON.parse(body);
          
          // Validate required params
          if (!params.jiraUrl || !params.jiraUser || !params.jiraApiToken || !params.jql) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required parameters: jiraUrl, jiraUser, jiraApiToken, jql' }));
            return;
          }
          
          // Create config from params
          const config = {
            JIRA_URL: params.jiraUrl,
            JIRA_USER: params.jiraUser,
            JIRA_API_TOKEN: params.jiraApiToken
          };
          
          // Load theme
          let theme = DEFAULT_THEME;
          if (params.theme) {
            theme = params.theme;
          }
          
          const client = new JiraClient(config);
          
          // Fetch current issues
          verbose('Fetching issues from Jira...');
          const issues = await client.getAllIssues(params.jql);
          
          if (issues.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'No issues found',
              columns: []
            }));
            return;
          }
          
          // Get all unique status IDs
          const allStatusIds = extractUniqueStatusIds(issues);
          verbose(`Found ${allStatusIds.length} unique statuses`);
          
          // Fetch status metadata
          verbose('Fetching status metadata...');
          const allStatuses = await client.getStatusesByIds(allStatusIds);
          const statusCategoryMap = buildStatusCategoryMap(allStatuses);
          const allStatusNameToIdMap = buildStatusNameToIdMap(allStatuses);
          
          // Handle SLE calculation if requested
          let slesByStatusId = new Map();
          if (params.jqlSLE) {
            verbose('Fetching historical issues for SLE calculation...');
            const historicalIssues = await client.getAllIssues(params.jqlSLE);
            
            if (historicalIssues.length > 0) {
              const transitions = extractStatusTransitions(historicalIssues, statusCategoryMap);
              const sleWindow = params.sleWindow ? parseInt(params.sleWindow) : 90;
              const percentiles = [50, 70, 85, 95];
              slesByStatusId = calculateSLEsForStatuses(transitions, sleWindow, percentiles);
            }
          }
          
          // Transform to output format
          const referenceDate = params.date || new Date().toISOString();
          const maxDays = params.maxDays ? parseInt(params.maxDays) : null;
          const columnsOrder = params.columnsOrder || null;
          
          const output = buildOutput(
            issues, 
            referenceDate, 
            config.JIRA_URL, 
            theme, 
            statusCategoryMap, 
            slesByStatusId, 
            columnsOrder, 
            maxDays, 
            allStatusNameToIdMap
          );
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(output));
          
        } catch (error) {
          console.error('Error generating chart:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: error.message,
            stack: VERBOSITY >= 2 ? error.stack : undefined
          }));
        }
      });
      
      return;
    }
    
    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  server.listen(PORT, () => {
    console.log(`✓ Jira API Server running on http://localhost:${PORT}`);
    console.log(`✓ POST to http://localhost:${PORT}/generate-chart to generate charts`);
    console.log(`✓ Press Ctrl+C to stop`);
  });
}