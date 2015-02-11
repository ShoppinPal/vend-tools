var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var nconf = require('nconf');
var path = require('path');

var updateOauthTokens = function(connectionInfo, response){
  console.log('updating oauth.json ... in case there might have been token changes');
  //console.log('connectionInfo: ' + JSON.stringify(connectionInfo,null,2));
  var oauthFile = path.join(__dirname, '..', 'oauth.json');
  console.log('oauthFile: ' + oauthFile);
  return fileSystem.write(
    oauthFile,
    JSON.stringify({
      'access_token': connectionInfo.accessToken,
      'token_type': 'Bearer',
      'refresh_token': connectionInfo.refreshToken,
      'domain_prefix': connectionInfo.domainPrefix
    },null,2))
    .then(function() {
      return Promise.resolve(response); // just passing it through to the next block
    });
};

// TODO: add a CLI spinner to indicate file is being saved? Because sometimes the pauses may appear long?
var loadOauthTokens = function(token, domain){
  // (1) Check for oauth.json and client.json via nconf
  nconf.file('client', { file: path.join(__dirname, '..', 'client.json') })
    .file('oauth', { file: path.join(__dirname, '..', 'oauth.json') });
  //console.log('nconf.get(): ', nconf.get());

  // (2) try to load client_id and client_secret and whatever else
  var connectionInfo = {
    domainPrefix: nconf.get('domain_prefix') || domain,
    accessToken: nconf.get('access_token') || token,
    // if you want auto-reties on 401, additional data is required:
    refreshToken: nconf.get('refresh_token'),
    vendTokenService: nconf.get('token_service'),
    vendClientId: nconf.get('client_id'),
    vendClientSecret: nconf.get('client_secret')
  };
  //console.log('connectionInfo: ', connectionInfo);

  // (3) if not successful then ask for it as CLI arguments
  if (!connectionInfo.accessToken) {
    throw new Error('--token should be set');
  }
  if (!connectionInfo.domainPrefix) {
    throw new Error('--domain should be set');
  }

  return connectionInfo;
};

exports.updateOauthTokens = updateOauthTokens;
exports.loadOauthTokens = loadOauthTokens;
