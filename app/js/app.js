'use strict'

import fetch from 'node-fetch';
import angular from 'angular';
import { stringify } from 'querystring';
import { parseMail } from './mailparse';
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
      SELECTION: 1,
      UPDATE: 2,
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

  $scope.sheets = null;
  $scope.file = null;
  $scope.name = null;
  $scope.sheet = null;
  $scope.appState = AppStates.AUTH;
  $scope.waiting = false;

  $scope.startAuth = async () => {
    $scope.waiting = true;

    var auth_token = await openAuthWindow();
    if (auth_token !== null) {
      $scope.access_token = await googleapi.getToken(auth_token);
      if ($scope.access_token !== null) {
        $scope.sheets = await googleapi.getDriveSpreadsheets($scope.access_token);

        $scope.waiting = false;
        if ($scope.sheets !== null) {
          $scope.appState = AppStates.SELECTION;
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
    componentHandler.upgradeAllRegistered();
  };

  $scope.sheetSelected = (file_id, file_name, sheet_name) => {
    $scope.file  = file_id;
    $scope.file_name  = file_name;
    $scope.sheet = sheet_name;
    $scope.appState = AppStates.UPDATE;
  };

  $scope.selectMailAndUpdate = async () => {
    $scope.waiting = true;
    var fileName = await selectFile();
    console.log(fileName);
    var data = await parseMail(fileName,
      ["Street Address", "City", "County", "State", "Zip", "Occupancy Status", "Starting Bid"]);
    console.log(data);
    var res = await googleapi.updateInfo($scope.access_token, $scope.file, $scope.sheet, data);
    console.log(res);
    alert("Synchronization finsihed. Please check your Google spreadsheet.");
    console.log(data);
    $scope.waiting = false;
    $scope.$apply();
  };
});

realestateApp.run(function ($rootScope, $timeout) {
    $rootScope.$on('$viewContentLoaded', ()=> {
      $timeout(() => {
        componentHandler.upgradeAllRegistered();
      })
    })
  });
