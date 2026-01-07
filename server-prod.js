#!/usr/bin/env node

/**
 * Production server for Aging WIP UI
 * Serves static files from dist/ and handles API endpoints
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { 
  JiraClient, 
  buildOutput, 
  extractUniqueStatusIds,
  buildStatusCategoryMap,
  buildStatusNameToIdMap,
  extractStatusTransitions,
  calculateSLEsForStatuses,
  parseWindow,
  DEFAULT_THEME
} from './cli/get-jira-issues.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

const app = express();

// Parse JSON bodies
app.use(express.json());

// API endpoint for generating chart data
app.post('/api/chart-data', async (req, res) => {
  try {
    const params = req.body;
    
    if (!params.jiraUrl || !params.jiraUser || !params.jiraApiToken || !params.jql) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Create config and client
    const config = {
      JIRA_URL: params.jiraUrl,
      JIRA_USER: params.jiraUser,
      JIRA_API_TOKEN: params.jiraApiToken
    };
    
    const client = new JiraClient(config);
    
    // Fetch issues
    const issues = await client.getAllIssues(params.jql);
    
    if (issues.length === 0) {
      return res.json({ columns: [] });
    }

    // Get status metadata
    const statusIds = extractUniqueStatusIds(issues);
    const statuses = await client.getStatusesByIds(statusIds);
    const statusCategoryMap = buildStatusCategoryMap(statuses);
    const allStatusNameToIdMap = buildStatusNameToIdMap(statuses);

    // Calculate SLEs if requested
    let slesByStatusId = null;
    if (params.jqlSLE) {
      const historicalIssues = await client.getAllIssues(params.jqlSLE);
      if (historicalIssues.length > 0) {
        const transitions = extractStatusTransitions(historicalIssues, statusCategoryMap);
        const window = parseWindow(params.sleWindow ? `${params.sleWindow}d` : '90d', params.date || new Date().toISOString());
        const percentiles = [50, 75, 85, 90];
        slesByStatusId = calculateSLEsForStatuses(transitions, window, percentiles);
      }
    }

    // Build output
    const referenceDate = params.date || new Date().toISOString();
    const chartData = buildOutput(
      issues,
      referenceDate,
      config.JIRA_URL,
      DEFAULT_THEME,
      statusCategoryMap,
      slesByStatusId,
      params.columnsOrder || null,
      params.maxDays || null,
      allStatusNameToIdMap
    );
    
    res.json(chartData);
    
  } catch (error) {
    console.error('API error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes (must be last)
app.use((req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✓ Aging WIP UI running on http://localhost:${PORT}`);
  console.log(`✓ Serving static files from: ${join(__dirname, 'dist')}`);
  console.log(`✓ API endpoint: http://localhost:${PORT}/api/chart-data`);
  console.log(`✓ Press Ctrl+C to stop\n`);
});
