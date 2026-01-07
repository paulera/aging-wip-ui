/**
 * Client-side Jira API utilities
 * Calls /api endpoints which are proxied to the CLI server
 */

const MAX_RESULTS_PER_PAGE = 100;
const RATE_LIMIT_DELAY = 100;

const DEFAULT_THEME = {
  "theme_name": "Default Theme",
  "theme_author_name": "System",
  "theme_author_email": "system@example.com",
  "sle_colors": ["#86efac", "#fef08a", "#fde047", "#fdba74", "#fca5a5"],
  "types": {
    "Task": { "color": "#3b82f6", "borderColor": "#2563eb", "borderWidth": 1, "icon": "TA" },
    "Bug": { "color": "#ef4444", "borderColor": "#dc2626", "borderWidth": 2, "icon": "BU" },
    "Story": { "color": "#10b981", "borderColor": "#059669", "borderWidth": 1, "icon": "US" }
  },
  "priorities": {
    "Highest": "🔴",
    "High": "🟠",
    "Medium": "🟡",
    "Low": "🟢",
    "Lowest": "🔵"
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if API server is available
 */
export async function checkAPI() {
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Generate chart using API endpoint
 */
export async function generateChartViaAPI(params) {
  const response = await fetch('/api/chart-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Server error: ${response.status}`);
  }

  return response.json();
}

export class JiraClient {
  constructor(jiraUrl, jiraUser, jiraApiToken) {
    this.jiraUrl = jiraUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authHeader = 'Basic ' + btoa(`${jiraUser}:${jiraApiToken}`);
  }

  async request(endpoint) {
    const url = `${this.jiraUrl}${endpoint}`;
    
    await sleep(RATE_LIMIT_DELAY);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
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
      'issuelinks'
    ];

    const endpoint = `/rest/api/3/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${MAX_RESULTS_PER_PAGE}&fields=${fields.join(',')}&expand=changelog`;
    
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
      }

      startAt += response.issues.length;
    } while (allIssues.length < total);

    // The search API returns incomplete changelogs. Fetch complete changelogs for non-done issues.
    // We only need complete changelogs for active issues that will be displayed on the board.
    const activeIssues = allIssues.filter(issue => {
      const statusCategory = issue.fields.status?.statusCategory?.key;
      return statusCategory !== 'done';
    });
    
    if (activeIssues.length > 0) {
      console.log(`Fetching complete changelogs for ${activeIssues.length} active issues (skipping ${allIssues.length - activeIssues.length} done issues)...`);
      
      // Process in batches of 10 concurrent requests for better performance
      const batchSize = 10;
      for (let i = 0; i < activeIssues.length; i += batchSize) {
        const batch = activeIssues.slice(i, Math.min(i + batchSize, activeIssues.length));
        await Promise.all(batch.map(async (issue) => {
          try {
            const fullIssue = await this.request(`/rest/api/3/issue/${issue.key}?expand=changelog&fields=changelog`);
            if (fullIssue.changelog) {
              issue.changelog = fullIssue.changelog;
            }
          } catch (error) {
            console.warn(`Warning: Could not fetch complete changelog for ${issue.key}:`, error.message);
          }
        }));
      }
      console.log(`Completed changelog enrichment`);
    } else {
      console.log(`No active issues require changelog enrichment`);
    }
    
    return allIssues;
  }

  async getStatusesByIds(statusIds) {
    if (statusIds.length === 0) {
      return [];
    }
    
    const idsParam = statusIds.map(id => `id=${id}`).join('&');
    return this.request(`/rest/api/3/statuses?${idsParam}`);
  }
}

// Data transformation functions
function formatDate(isoDateString) {
  const date = new Date(isoDateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

function calculateAge(createdDate, referenceDate) {
  const created = new Date(createdDate);
  const reference = new Date(referenceDate);
  const diffMs = reference - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function extractUniqueStatusIds(issues) {
  const statusIds = new Set();
  
  issues.forEach(issue => {
    if (issue.fields.status?.id) {
      statusIds.add(issue.fields.status.id);
    }
    
    if (issue.changelog?.histories) {
      issue.changelog.histories.forEach(history => {
        history.items?.forEach(item => {
          if (item.field === 'status') {
            if (item.from) statusIds.add(item.from);
            if (item.to) statusIds.add(item.to);
          }
        });
      });
    }
  });
  
  return Array.from(statusIds);
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
        map.set(status.name, categoryKey);
      }
    }
  });
  return map;
}

function buildStatusNameToIdMap(statuses) {
  const map = new Map();
  statuses.forEach(status => {
    map.set(status.name, status.id);
  });
  return map;
}

function groupIssuesByStatus(issues, statusCategoryMap) {
  const columnMap = new Map();
  
  issues.forEach(issue => {
    const status = issue.fields.status;
    if (!status) return;
    
    const category = statusCategoryMap.get(status.id) || statusCategoryMap.get(status.name) || 'undefined';
    if (category === 'done') return; // Skip done items
    
    if (!columnMap.has(status.name)) {
      columnMap.set(status.name, []);
    }
    columnMap.get(status.name).push(issue);
  });
  
  return columnMap;
}

function transformIssue(issue, referenceDate, jiraUrl) {
  const fields = issue.fields;
  const age = calculateAge(fields.created, referenceDate);
  
  const transformed = {
    key: issue.key,
    title: fields.summary || 'No title',
    type: fields.issuetype?.name || 'Unknown',
    age: age,
    age_in_current_state: age, // Simplified for now
    start_date: fields.created,
    current_state_start_date: fields.created, // Simplified for now
    priority: fields.priority?.name || 'Medium',
    assignee: {
      name: fields.assignee?.displayName || 'Unassigned',
      picture: fields.assignee?.avatarUrls?.['48x48'] || '',
      link: fields.assignee?.self || '#'
    },
    labels: fields.labels || [],
    parent: fields.parent ? {
      key: fields.parent.key,
      title: fields.parent.fields?.summary || '',
      url: `${jiraUrl}/browse/${fields.parent.key}`
    } : null,
    url: `${jiraUrl}/browse/${issue.key}`
  };
  
  // Check for blockers/dependencies
  if (fields.issuelinks) {
    const blocker = fields.issuelinks.find(link => 
      link.type.name === 'Blocks' && link.inwardIssue
    );
    if (blocker) {
      transformed.depends_on = blocker.inwardIssue.key;
    }
  }
  
  return transformed;
}

export function buildChartData(issues, jiraUrl, theme = DEFAULT_THEME) {
  const referenceDate = formatDate(new Date().toISOString());
  const statuses = extractUniqueStatusIds(issues);
  
  // For simplicity, we'll group by current status without full status metadata
  // In a full implementation, you'd fetch status metadata from Jira
  const columnMap = new Map();
  let maxAge = 0;
  
  issues.forEach(issue => {
    const status = issue.fields.status?.name || 'Unknown';
    const statusCategory = issue.fields.status?.statusCategory?.key || 'undefined';
    
    // Skip done items
    if (statusCategory === 'done') return;
    
    if (!columnMap.has(status)) {
      columnMap.set(status, []);
    }
    
    const transformed = transformIssue(issue, referenceDate, jiraUrl);
    maxAge = Math.max(maxAge, transformed.age);
    columnMap.get(status).push(transformed);
  });
  
  // Build columns
  const columns = [];
  let order = 1;
  
  columnMap.forEach((items, statusName) => {
    columns.push({
      name: statusName,
      top_text: `WIP: ${items.length}`,
      order: order++,
      sle: [], // SLE calculation would go here
      items: items.sort((a, b) => a.key.localeCompare(b.key))
    });
  });
  
  return {
    title: "Jira Aging WIP",
    subtitle: `As of ${referenceDate}`,
    reference_date: referenceDate,
    board_url: jiraUrl,
    min_days: 0,
    max_days: Math.max(30, Math.ceil(maxAge * 1.1)),
    theme: theme,
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
