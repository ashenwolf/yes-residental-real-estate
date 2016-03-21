'use strict'

import fetch from 'node-fetch';
import angular from 'angular';
import { stringify } from 'querystring';
import mailTools from './mailparse';
import googleapi from './googleapi';

const remote = require('electron').remote;
const BrowserWindow = remote.BrowserWindow;
const Dialog = remote.require('dialog');

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

var realestateApp = angular.module('realestateApp', []);

realestateApp.controller('RealEstateCtrl', function ($scope) {
  const AppStates = Object.freeze({
      AUTH: 0,
      MAIL_SELECTION: 1,
      SHEET_SELECTION: 2,
      UPDATE: 3,
  });

  function openAuthWindow() {
    return new Promise((accept, reject) => {
      const win = new BrowserWindow(browserWindowParams || {'use-content-size': true });
      win.loadURL(googleapi.url);
      win.on('closed', () => { reject(null); });
      win.on('page-title-updated', () => {
        setImmediate(() => {
          const title = win.getTitle();
          if (title.startsWith('Denied')) {
            reject(null);
            win.removeAllListeners('closed');
            win.close();
          } else if (title.startsWith('Success')) {
            accept(title.split(/[ =]/)[2]);
            win.removeAllListeners('closed');
            win.close();
          }
        });
      });
      win.show();
    });
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

  $scope.AppStates = AppStates;

  $scope.labels = [];
  $scope.threads = [];
  $scope.visible_threads = [];
  $scope.selected_label = null;
  $scope.sheets = null;
  $scope.file = null;
  $scope.file_name = null;
  $scope.sheet = null;
  $scope.appState = AppStates.AUTH;
  $scope.waiting = false;

  $scope.startAuth = async () => {
    $scope.waiting = true;

    var auth_token = await openAuthWindow();
    if (auth_token !== null) {
      $scope.access_token = await googleapi.getToken(auth_token);
      if ($scope.access_token !== null) {
        $scope.labels = await googleapi.getGmailLabels($scope.access_token);

        $scope.waiting = false;
        if ($scope.labels !== null) {
          $scope.appState = AppStates.MAIL_SELECTION;
        }
        else
          $scope.appState = AppStates.AUTH;
      }
    }
    else {
      alert("Authentication failed.");
      $scope.appState = AppStates.AUTH;
      $scope.waiting = false;
    }
    $scope.$apply();
  };

  $scope.updateMails = async () => {
    $scope.waiting = true;
    $scope.threads = await googleapi.getGmailThreads($scope.access_token, $scope.selected_label);
    console.log($scope.threads);
    $scope.visible_threads = $scope.threads;
    $scope.waiting = false;
    $scope.$apply();
  }

  $scope.expandThread = async (id) => {
    $scope.waiting = true;
    var visible_threads = [];
    for (var i = 0; i < $scope.threads.length; i++) {
      var thread = $scope.threads[i];
      visible_threads.push(thread);
      console.log(thread.id);
      console.log(id);
      if (thread.id === id) {
        thread.expanded = true;
        var messages = await googleapi.getMessagesFromThread($scope.access_token, id);
        visible_threads = visible_threads.concat(messages);
      }
    }
    console.log(visible_threads);
    $scope.visible_threads = visible_threads;
    $scope.waiting = false;
    $scope.$apply();
  }

  $scope.collapseThread = (i, id) => {
    $scope.threads[i].expanded = false;
    $scope.visible_threads = $scope.threads;
  }

  $scope.useMail = async (id) => {
    $scope.waiting = true;
    $scope.mail_data = await googleapi.getGmailRawMessage($scope.access_token, id);
    $scope.sheets = await googleapi.getDriveSpreadsheets($scope.access_token);
    if ($scope.mail_data != null && $scope.sheets != null) {
      $scope.appState = AppStates.SHEET_SELECTION;
    }
    $scope.waiting = false;
    $scope.$apply();
    componentHandler.upgradeAllRegistered();
  }

  $scope.sheetSelected = async (file_id, file_name, sheet_name) => {
    $scope.file  = file_id;
    $scope.file_name  = file_name;
    $scope.sheet = sheet_name;
    $scope.sheet_data = await mailTools.parseMailString($scope.mail_data,
      ["Street Address", "City", "County", "State", "Zip", "Occupancy Status", "Starting Bid"]);
    $scope.appState = AppStates.UPDATE;
    $scope.$apply();
  };

  $scope.selectMailAndUpdate = async () => {
    $scope.waiting = true;
    var res = await googleapi.updateInfo($scope.access_token,
      $scope.file, $scope.sheet, $scope.sheet_data);
    console.log(res);
    $scope.waiting = false;
    $scope.$apply();
    alert("Synchronization finsihed. Please check your Google spreadsheet.");
  };
});

realestateApp.run(function ($rootScope, $timeout) {
    $rootScope.$on('$viewContentLoaded', ()=> {
      $timeout(() => {
        componentHandler.upgradeAllRegistered();
      })
    })
  });
