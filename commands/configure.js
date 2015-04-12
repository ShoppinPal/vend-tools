var Command = require('ronin').Command;

var Promise = require('bluebird');
var asking = Promise.promisifyAll(require('asking'));
var fileSystem = require('q-io/fs');
var path = require('path');

// Global variable for logging
var commandName = path.basename(__filename, '.js'); // gives the filename without the .js extension

// This command's implementation
var Configure = Command.extend({
  desc: 'Configures client.json, oauth.json and settings.json for vend-tools',

  options: { // must not clash with global aliases: -t -d -f
    env: 'string'
  },

  run: function (env) {
    var nconf = require('nconf');
    if(env && env.length>0){
      nconf.file('client', { file: path.join(__dirname, '..', 'client.'+env+'.json') });
      nconf.file('oauth', { file: path.join(__dirname, '..', 'oauth.'+env+'.json') });
      nconf.file('settings', { file: path.join(__dirname, '..', 'settings.'+env+'.json') });
    }
    else {
      nconf.file('client', { file: path.join(__dirname, '..', 'client.json') });
      nconf.file('oauth', { file: path.join(__dirname, '..', 'oauth.json') });
      nconf.file('settings', { file: path.join(__dirname, '..', 'settings.json') });
    }
    //console.log(nconf.get());

    return getSettingsInfo(nconf)
      .then(function () {
        return getClientInfo(nconf)
      })
      .then(function () {
        return getOauthInfo(nconf)
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

var getClientInfo = function(nconf, client){
  var client = {};
  return asking.askAsync('Please provide a client_id: ', { default: nconf.get('client_id') })
    .tap(function (resolvedResults) {
      client.client_id = resolvedResults;
    })
    .then(function () {
      return asking.askAsync('Please provide a client_secret: ', { default: nconf.get('client_secret') });
    })
    .tap(function (resolvedResults) {
      client.client_secret = resolvedResults;
    })
    .then(function () {
      client.token_service = 'https://{DOMAIN_PREFIX}.vendhq.com/api/1.0/token';
      return fileSystem.write(
        path.join(__dirname, '..', 'client.json'),
        JSON.stringify(client,null,2));
    });
};

var getOauthInfo = function(nconf){
  var oauth = {};
  return asking.askAsync('Please provide a domain_prefix: ', { default: nconf.get('domain_prefix') })
    .tap(function (resolvedResults) {
      oauth.domain_prefix = resolvedResults;
    })
    .then(function () {
      return asking.askAsync('Please provide a refresh_token: ', { default: nconf.get('refresh_token') });
    })
    .tap(function (resolvedResults) {
      oauth.refresh_token = resolvedResults;
    })
    .then(function () {
      return asking.askAsync('Please provide an access_token: ', { default: nconf.get('access_token') });
    })
    .tap(function (resolvedResults) {
      oauth.access_token = resolvedResults;
    })
    .then(function () {
      oauth.token_type = 'Bearer';
      return fileSystem.write(
        path.join(__dirname, '..', 'oauth.json'),
        JSON.stringify(oauth,null,2));
    });
};

var getSettingsInfo = function(nconf){
  var settings = {};
  return chooseDefaultOutputDirectory(nconf, settings)
    .tap(function () {
      return chooseTimestampFiles(settings);
    })
    .then(function () {
      return fileSystem.write(
        path.join(__dirname, '..', 'settings.json'),
        JSON.stringify(settings,null,2));
    });
};

var chooseDefaultOutputDirectory = function(nconf, settings){
  return asking.chooseAsync('Do you want to set a default output directory?', ['Yes', 'No'])
    .then(function (resolvedResults/*err, selectedValue, indexOfSelectedValue*/) {
      var selectedValue = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      //console.log(selectedValue, indexOfSelectedValue);
      if (selectedValue==='Yes') {
        return asking.askAsync(
          /*'Windows example: C:\\user\\cloud\\shared\\folder\n' +
           'Unix/Mac example: /user/cloud/shared/folder\n' +*/
          'Please provide a defaultOutputDirectory:\n',
          { default: nconf.get('defaultOutputDirectory') }
        )
          .tap(function (resolvedResults) {
            settings.defaultOutputDirectory = resolvedResults;
          });
      }
      else {
        settings.defaultOutputDirectory = nconf.get('defaultOutputDirectory') || '';
        return Promise.resolve();
      }
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose 1 or 2');
      return chooseDefaultOutputDirectory(nconf, settings);
    });
};

var chooseTimestampFiles = function(settings){
  return asking.chooseAsync('Do you want all output files to have timestamps as part of their names?', ['Yes', 'No'])
    .tap(function (resolvedResults/*err, selectedValue, indexOfSelectedValue*/) {
      var selectedValue = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      if (selectedValue==='Yes') {
        settings.timestampFiles = true;
      }
      else {
        settings.timestampFiles = false;
      }
      return Promise.resolve();
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose 1 or 2');
      return chooseTimestampFiles(settings);
    });
};

module.exports = Configure;
