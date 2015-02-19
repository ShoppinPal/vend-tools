var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var Promise = require('bluebird');
var _ = require('underscore');
var path = require('path');

var FetchProductByHandle = Command.extend({
  desc: 'Fetches a product by handle',

  options: {
    handle: 'string'
  },

  run: function (handle) {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token || this.global.t;
    var domain = this.global.domain || this.global.d;

    if (!handle) {
      throw new Error('--handle should be set');
    }
    var connectionInfo = utils.loadOauthTokens(token, domain);

    return vendSdk.products.fetchByHandle({handle:{value:handle}}, connectionInfo)
      .then(function(response) {
        console.log(commandName + ' > 1st then block');
        return utils.updateOauthTokens(connectionInfo,response);
      })
      .then(function(response) {
        console.log(commandName + ' > 2nd then block');
        //console.log(commandName + ' > response.products[0]: ' + JSON.stringify(response.products[0],vendSdk.replacer,2));

        if (response.products[0]) {
          console.log(commandName + ' > ' + response.products.length + ' matching results were found.');
          return utils.exportToJsonFileFormat(commandName, response.products[0]);
        }
        else {
          console.log(commandName + ' > No matching result(s) were found.');
          return Promise.resolve();
        }
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = FetchProductByHandle;
