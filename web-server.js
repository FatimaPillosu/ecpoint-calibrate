const express = require('express')
const path = require('path')
const fs = require('fs')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const PORT = process.env.PORT || 3000
const FLASK_BACKEND = process.env.FLASK_BACKEND || 'http://localhost:8888'

// --- Proxy: Forward API requests to Flask backend ---
// IMPORTANT: Proxy must be registered BEFORE express.json() so the raw body is forwarded intact.
const proxyPaths = [
  '/computations',
  '/predictors',
  '/loaders',
  '/postprocessing',
  '/get-predictor-metadata',
  '/get-pdt-metadata',
  '/healthcheck',
  '/environment',
]

proxyPaths.forEach((apiPath) => {
  app.use(
    apiPath,
    createProxyMiddleware({
      target: FLASK_BACKEND,
      changeOrigin: true,
      timeout: 600000,        // 10 minutes — large PDT files need time to parse
      proxyTimeout: 600000,
    })
  )
})

// Parse JSON bodies (only affects non-proxied routes below)
app.use(express.json({ limit: '50mb' }))

// --- Static file serving ---
app.use('/dist', express.static(path.join(__dirname, 'dist')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

// --- API: App version ---
app.get('/api/version', (req, res) => {
  const pkg = require('./package.json')
  res.json({ version: pkg.version })
})

// --- API: Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// --- API: Browse directory contents ---
app.post('/api/browse/directory', (req, res) => {
  let { path: dirPath } = req.body

  if (!dirPath) {
    // Default to home directory
    dirPath = process.env.HOME || process.env.USERPROFILE || '/'
  }

  try {
    // Resolve the path
    const resolvedPath = path.resolve(dirPath)

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist', path: resolvedPath })
    }

    const stat = fs.statSync(resolvedPath)
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory', path: resolvedPath })
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })

    const directories = []
    const files = []

    for (const entry of entries) {
      // Skip hidden files/directories
      if (entry.name.startsWith('.')) continue

      try {
        const fullPath = path.join(resolvedPath, entry.name)
        // Use fs.statSync to follow symlinks (OneDrive folders appear as symlinks on Windows)
        const fileStat = fs.statSync(fullPath)
        if (fileStat.isDirectory()) {
          directories.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
          })
        } else if (fileStat.isFile()) {
          files.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
            size: fileStat.size,
          })
        }
      } catch (e) {
        // Skip entries we can't access
        continue
      }
    }

    // Sort alphabetically
    directories.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))

    res.json({
      path: resolvedPath,
      parent: path.dirname(resolvedPath),
      directories,
      files,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- API: Browse files with optional filter ---
app.post('/api/browse/files', (req, res) => {
  let { path: dirPath, filter } = req.body

  if (!dirPath) {
    dirPath = process.env.HOME || process.env.USERPROFILE || '/'
  }

  try {
    const resolvedPath = path.resolve(dirPath)

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      return res.status(404).json({ error: 'Invalid directory path' })
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })
    const files = []

    // Parse filter extensions (e.g., "*.ascii,*.parquet" -> [".ascii", ".parquet"])
    let filterExts = null
    if (filter) {
      filterExts = filter
        .split(',')
        .map((f) => f.trim().replace('*', ''))
        .filter((f) => f)
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      try {
        const fullPath = path.join(resolvedPath, entry.name)
        if (entry.isFile()) {
          // Apply filter if provided
          if (filterExts && !filterExts.some((ext) => entry.name.endsWith(ext))) {
            continue
          }
          const fileStat = fs.statSync(fullPath)
          files.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
            size: fileStat.size,
          })
        }
      } catch (e) {
        continue
      }
    }

    files.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ path: resolvedPath, files })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- API: Read file content ---
app.post('/api/read-file', (req, res) => {
  const { path: filePath } = req.body

  if (!filePath) {
    return res.status(400).json({ error: 'path is required' })
  }

  try {
    const resolvedPath = path.resolve(filePath)
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File does not exist' })
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8')
    res.json({ content, path: resolvedPath })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- API: Write file content ---
app.post('/api/write-file', (req, res) => {
  const { path: filePath, content } = req.body

  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content are required' })
  }

  try {
    const resolvedPath = path.resolve(filePath)
    const dir = path.dirname(resolvedPath)

    // Ensure parent directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8')
    res.json({ success: true, path: resolvedPath })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- API: Read log file ---
app.post('/api/logs', (req, res) => {
  const os = require('os')
  const defaultLogPath = path.join(os.tmpdir(), 'ecpoint', 'ecpoint.logs')
  const logPath = req.body.path || defaultLogPath
  const lines = req.body.lines || 200

  try {
    if (!fs.existsSync(logPath)) {
      return res.json({ content: 'Log file not found.', path: logPath })
    }

    const content = fs.readFileSync(logPath, 'utf-8')
    const allLines = content.split('\n')
    const tailLines = allLines.slice(-lines).join('\n')

    res.json({ content: tailLines, path: logPath, totalLines: allLines.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- API: Serve a file (for PDF viewing, etc.) ---
app.get('/api/serve-file', (req, res) => {
  const filePath = req.query.path

  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' })
  }

  try {
    const resolvedPath = path.resolve(filePath)
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File does not exist' })
    }

    res.sendFile(resolvedPath)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n  ecPoint-Calibrate Web UI`)
  console.log(`  =======================`)
  console.log(`  Frontend:  http://localhost:${PORT}`)
  console.log(`  Backend:   ${FLASK_BACKEND}`)
  console.log(`\n  Open http://localhost:${PORT} in your browser.\n`)
})
