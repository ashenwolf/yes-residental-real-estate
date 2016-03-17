'use strict'

import google from 'googleapis';
import fetch from 'node-fetch';
import { stringify } from 'querystring';
import { parseMail } from './mailparse';

const remote = require('electron').remote;
const BrowserWindow = remote.BrowserWindow;
const Dialog = remote.require('dialog');
const config = require('./config/release.json');

const oauth2Client =
  new google.auth.OAuth2(config.client_id, config.client_secret, 'urn:ietf:wg:oauth:2.0:oob');

const AppStates = Object.freeze({
    AUTH: 0,
    AUTH_WAIT: 1,
    SELECTION: 2,
    UPDATE: 3,
    UPDATE_WAIT: 4
});

const browserWindowParams = {
     'use-content-size': true,
     'center': true,
     'show': false,
     'resizable': false,
     'always-on-top': true,
     'standard-window': true,
     'auto-hide-menu-bar': true,
     'node-integration': false
 };

 function getAuthenticationUrl(scopes) {
   const url = oauth2Client.generateAuthUrl({
     access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
     scope: scopes // If you only need one scope you can pass it as string
   });
   return url;
 }

const SCOPE = ['https://www.googleapis.com/auth/drive',
               'https://www.googleapis.com/auth/spreadsheets'];

var url = getAuthenticationUrl(SCOPE);

var file, name, sheet;

function authFailed() {
  alert("Authentication failed.");
  appState = AppStates.AUTH;
  updateUI();
}

function authSucceeded(token)
  {
  oauth2Client.getToken(token, function(err, tokens) {
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    if (!err) {
      console.log(tokens);
      oauth2Client.setCredentials(tokens);
      getDriveFolders(oauth2Client);
      }
    });
  }

function getDriveFolders(authData) {
  // Create an execution request object.
  var request = {
      'function': 'getAllSpreadsheets',
      'parameters': []
      };

  var script = google.script({ version: 'v1', auth: authData});

  // Make the API request.
  script.scripts.run({scriptId: config.script_id, resource: request},
    function(err, resp) {
      console.log(err);
      if (!err) {
        appState = AppStates.SELECTION;
        console.log(resp);
        populateSheets(resp.response.result);
      }
      else {
        alert(err);
        appState = AppStates.AUTH;
      }
      updateUI();
    });
}

function updateInfo(authData, fileId, sheet, data) {
  appState = AppStates.UPDATE_WAIT;
  updateUI();

  // Create an execution request object.
  var request = {
      'function': 'updateEntries',
      'parameters': [fileId, sheet, data]
      };

  var script = google.script({ version: 'v1', auth: authData});

  // Make the API request.
  script.scripts.run({scriptId: config.script_id, resource: request},
    function(err, resp) {
      console.log(err);
      if (!err) {
        alert("Update succeeded. Please check your sheet.");
        appState = AppStates.UPDATE;
        updateUI();
      }
    });
}

function openAuthWindow(url)
  {
  appState = AppStates.AUTH_WAIT;
  updateUI();

  const win = new BrowserWindow(browserWindowParams || {'use-content-size': true });
  win.loadURL(url);
  win.on('closed', () => { authFailed(); });
  win.on('page-title-updated', () => {
    setImmediate(() => {
      const title = win.getTitle();
      if (title.startsWith('Denied')) {
        authFailed();
        win.removeAllListeners('closed');
        win.close();
      } else if (title.startsWith('Success')) {
        authSucceeded(title.split(/[ =]/)[2]);
        win.removeAllListeners('closed');
        win.close();
      }
    });
  });
  win.show();
  }

function switchUpdating(selector, state) {
  var action_container = $(".mdl-card__actions .action-container", selector);
  var wait_container = $(".mdl-card__actions .wait-container", selector);

  if (state) {
    action_container.hide();
    wait_container.show();
  } else {
    wait_container.hide();
    action_container.show();
  }
}

function updateUI() {
  if (appState === AppStates.AUTH || appState === AppStates.AUTH_WAIT) {
    $(".tab-auth").addClass("is-active");
    $(".tab-select").removeClass("is-active");
    $(".tab-update").removeClass("is-active");

    switchUpdating($(".tab-auth"), appState === AppStates.AUTH_WAIT);
  }
  else if (appState === AppStates.SELECTION) {
    $(".tab-auth").removeClass("is-active");
    $(".tab-select").addClass("is-active");
    $(".tab-update").removeClass("is-active");
  }
  else if (appState === AppStates.UPDATE || appState === AppStates.UPDATE_WAIT) {
    $(".tab-auth").removeClass("is-active");
    $(".tab-select").removeClass("is-active");
    $(".tab-update").addClass("is-active");

    switchUpdating($(".tab-update"), appState === AppStates.UPDATE_WAIT);
  }
}

function sheetSelected() {
  file = $(this).data("file");
  name = $(this).data("filename");
  sheet = $(this).data("sheet");

  $("#filename").text(name);

  appState = AppStates.UPDATE;
  updateUI();
}

function populateSheets(values) {
  $(values).each((i, e) => {
    $(`<li class="mdl-list__item">
         <span class="mdl-list__item-primary-content">
           <img src="./img/sheets.png" width="32px">
           <span style="margin-left: 1em;">${e.name}</span>
         </span>
         <span class="mdl-list__item-secondary-action">
           <button id="sheet-selector-${i}"
              class="mdl-button mdl-js-button mdl-button--icon">
              <i class="material-icons">more_vert</i>
           </button>
           <ul class="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect"
               for="sheet-selector-${i}" id="sheet-menu-${i}">
            </ul>
         </span>
       </li>`).appendTo('#sheets');
       $(e.sheets).each((i1, e1) => {
         $(`<li class="mdl-menu__item" data-file="${e.id}"
              data-filename="${e.name}" data-sheet="${e1}">${e1}</li>`)
          .appendTo(`#sheet-menu-${i}`);
       })
  });
  componentHandler.upgradeAllRegistered();
  $("#sheets .mdl-menu > li").on("click", sheetSelected)
}

function selectFile() {
  return new Promise((resolve, reject) => {
    Dialog.showOpenDialog(
      { filters: [ { name: 'E-Mail', extensions: ['eml'] } ]},
      function (fileNames) {
        if (fileNames === undefined) reject(null);
        resolve(fileNames[0]);
      });
    });
}

async function selectMailAndUpdate() {
  var fileName = await selectFile();
  var data = await parseMail(fileName,
    ["Street Address", "City", "County", "State", "Zip", "Occupancy Status", "Starting Bid"]);
  updateInfo(oauth2Client, file, sheet, data)
  console.log(data);
}

$("#start-auth").on('click', () => openAuthWindow(url));
$("#estate-update").on('click', () => selectMailAndUpdate());

var appState = AppStates.AUTH;
updateUI();
