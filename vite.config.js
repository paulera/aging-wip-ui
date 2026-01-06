import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
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
} from './cli/get-jira-issues.js'

// Plugin to handle API endpoints
function apiPlugin() {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // API endpoint for generating chart data
        if (req.url === '/api/chart-data' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk.toString() })
          req.on('end', async () => {
            try {
              const params = JSON.parse(body)
              
              if (!params.jiraUrl || !params.jiraUser || !params.jiraApiToken || !params.jql) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing required parameters' }))
                return
              }

              // Create config and client
              const config = {
                JIRA_URL: params.jiraUrl,
                JIRA_USER: params.jiraUser,
                JIRA_API_TOKEN: params.jiraApiToken
              }
              
              const client = new JiraClient(config)
              
              // Fetch issues
              const issues = await client.getAllIssues(params.jql)
              
              if (issues.length === 0) {
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ columns: [] }))
                return
              }

              // Get status metadata
              const statusIds = extractUniqueStatusIds(issues)
              const statuses = await client.getStatusesByIds(statusIds)
              const statusCategoryMap = buildStatusCategoryMap(statuses)
              const allStatusNameToIdMap = buildStatusNameToIdMap(statuses)

              // Calculate SLEs if requested
              let slesByStatusId = null
              if (params.jqlSLE) {
                const historicalIssues = await client.getAllIssues(params.jqlSLE)
                if (historicalIssues.length > 0) {
                  const transitions = extractStatusTransitions(historicalIssues, statusCategoryMap)
                  const window = parseWindow(params.sleWindow ? `${params.sleWindow}d` : '90d', params.date || new Date().toISOString())
                  const percentiles = [50, 75, 85, 90]
                  slesByStatusId = calculateSLEsForStatuses(transitions, window, percentiles)
                }
              }

              // Build output
              const referenceDate = params.date || new Date().toISOString()
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
              )
              
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(chartData))
              
            } catch (error) {
              console.error('API error:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ 
                error: error.message,
                stack: error.stack
              }))
            }
          })
          return
        }
        
        // Health check
        if (req.url === '/api/health' && req.method === 'GET') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'ok' }))
          return
        }
        
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    apiPlugin(),
  ],
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
