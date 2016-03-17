'use strict';

// imports
import electron from 'electron';
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

let mainWindow = null;

require('electron-debug');

function createWindow () {
  mainWindow = new BrowserWindow({
    "width": 480,
    "height": 640,
    'resizable': false
  });
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

app.on('ready', createWindow);
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
