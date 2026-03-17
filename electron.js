const { app, BrowserWindow } = require('electron')
const path = require('path')

// Start the Express server
const server = require('./web-server')

let mainWindow = null

function createWindow() {
  const PORT = process.env.PORT || 3000

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.maximize()
  mainWindow.loadURL(`http://localhost:${PORT}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
