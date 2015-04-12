var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
//var Promise = require('bluebird');
var _ = require('underscore');
var path = require('path');

var ListOutlets = Command.extend({
  desc: 'List All Outlets',

  options: { // must not clash with global aliases: -t -d -f
  },

  run: function () {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);


    return vendSdk.outlets.fetch({}, connectionInfo)
      .tap(function(consignments) {
        return utils.updateOauthTokens(connectionInfo);
      })
      .then(function(outletsResponse) {
        console.log(commandName + ' > outletsResponse.outlets.length: ', outletsResponse.outlets.length);
        return utils.exportToJsonFileFormat(commandName, outletsResponse.outlets);
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListOutlets;
