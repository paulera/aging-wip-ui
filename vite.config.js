import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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

              // Set environment variables for CLI tool
              const env = {
                ...process.env,
                JIRA_URL: params.jiraUrl,
                JIRA_USER: params.jiraUser,
                JIRA_API_TOKEN: params.jiraApiToken
              }

              // Build CLI command with only JQL arguments
              const args = [`-j "${params.jql.replace(/"/g, '\\"')}"`]
              
              if (params.jqlSLE) args.push(`-s "${params.jqlSLE.replace(/"/g, '\\"')}"`)
              if (params.sleWindow) args.push(`-w ${params.sleWindow}d`)
              if (params.columnsOrder) args.push(`-o "${params.columnsOrder.replace(/"/g, '\\"')}"`)

              const cmd = `node cli/get-jira-issues.js ${args.join(' ')}`
              console.log('Executing:', cmd)
              console.log('With env:', { JIRA_URL: env.JIRA_URL, JIRA_USER: env.JIRA_USER })
              
              const { stdout, stderr } = await execAsync(cmd, { env })
              
              if (stderr) {
                console.log('CLI stderr:', stderr)
              }
              
              const chartData = JSON.parse(stdout)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(chartData))
              
            } catch (error) {
              console.error('API error:', error)
              console.error('Error details:', error.stderr || error.stdout)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ 
                error: error.message,
                stderr: error.stderr,
                stdout: error.stdout
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
