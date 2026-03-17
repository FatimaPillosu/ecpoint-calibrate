import axios from 'axios'

const api = axios.create({
  baseURL: window.location.origin,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

/**
 * Browse a directory and return its contents (subdirectories + files).
 * @param {string} dirPath - Absolute path to browse. If falsy, defaults to home.
 * @returns {Promise<{path, parent, directories, files}>}
 */
export const browseDirectory = async (dirPath) => {
  const { data } = await api.post('/api/browse/directory', { path: dirPath || '' })
  return data
}

/**
 * Browse files in a directory with an optional filter.
 * @param {string} dirPath
 * @param {string} filter - Comma-separated extensions, e.g. "*.ascii,*.parquet"
 * @returns {Promise<{path, files}>}
 */
export const browseFiles = async (dirPath, filter) => {
  const { data } = await api.post('/api/browse/files', { path: dirPath || '', filter })
  return data
}

/**
 * Read a file's text content from the server filesystem.
 * @param {string} filePath
 * @returns {Promise<{content, path}>}
 */
export const readFileContent = async (filePath) => {
  const { data } = await api.post('/api/read-file', { path: filePath })
  return data
}

/**
 * Write text content to a file on the server filesystem.
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<{success, path}>}
 */
export const writeFileContent = async (filePath, content) => {
  const { data } = await api.post('/api/write-file', { path: filePath, content })
  return data
}

/**
 * Read the tail of a log file.
 * @param {string} logPath - defaults to /var/tmp/ecpoint.logs
 * @param {number} lines - number of tail lines
 * @returns {Promise<{content, path, totalLines}>}
 */
export const readLogs = async (logPath, lines) => {
  const { data } = await api.post('/api/logs', { path: logPath, lines })
  return data
}

/**
 * Get the app version from the server.
 * @returns {Promise<string>}
 */
export const getAppVersion = async () => {
  const { data } = await api.get('/api/version')
  return data.version
}
