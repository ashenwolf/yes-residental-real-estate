'use strict'

import google from 'googleapis';
const config = require('./config/release.json');

const oauth2Client =
  new google.auth.OAuth2(config.client_id, config.client_secret, 'urn:ietf:wg:oauth:2.0:oob');

function getAuthenticationUrl(scopes) {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
    scope: scopes // If you only need one scope you can pass it as string
  });
  return url;
}

const SCOPE = ['https://mail.google.com/',
               'https://www.googleapis.com/auth/drive',
               'https://www.googleapis.com/auth/spreadsheets'];

function googleApiRequest(auth, name, params) {
  return new Promise((accept, reject) => {
    // Create an execution request object.
    console.log("request started");

    var request = {
      'function': name,
      'parameters': params
    };

    console.log(request);

    var script = google.script({ version: 'v1', auth: auth});

    // Make the API request.
    script.scripts.run(
      {scriptId: config.script_id, resource: request},
      function(err, resp) {
        console.log(resp);
        if (!err) {
          accept(resp.response.result);
        }
        else {
          console.log(err);
          reject(null);
        }
      }
    );
  });
}

exports = module.exports = {}

exports.url = getAuthenticationUrl(SCOPE);

exports.getToken = (token) => {
  return new Promise((accept, reject) => {
    oauth2Client.getToken(token, function(err, tokens) {
      // Now tokens contains an access_token and an optional refresh_token. Save them.
      if (!err) {
        console.log(tokens);
        oauth2Client.setCredentials(tokens);
        accept(oauth2Client);
      }
      else {
        reject(null);
      }
    });
  });
}

exports.getDriveSpreadsheets = (auth) => {
  return googleApiRequest(auth, 'getAllSpreadsheets', []);
}

exports.updateInfo = (auth, fileId, sheet, data) => {
  return googleApiRequest(auth, 'updateEntries', [fileId, sheet, data]);
}

exports.getGmailLabels = (auth) => {
  return googleApiRequest(auth, 'GetAllLabels', []);
}

exports.getGmailThreads = (auth, label) => {
  return googleApiRequest(auth, 'GetThreadsFromLabel', [label]);
}

exports.getMessagesFromThread = (auth, thread_id) => {
  return googleApiRequest(auth, 'GetMessagesFromThread', [thread_id]);
}

exports.getGmailRawMessage = (auth, message_id) => {
  return googleApiRequest(auth, 'GetMessageContent', [message_id]);
}
