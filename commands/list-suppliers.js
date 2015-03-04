var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
//var Promise = require('bluebird');
var moment = require('moment');
//var _ = require('underscore');
var path = require('path');

var ListSuppliers = Command.extend({
  desc: 'List Suppliers (200 at a time)',

  options: {
  },

  run: function () {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);

    var args = {
      page:{value: 1},
      pageSize:{value: 200}
    };
    return vendSdk.suppliers.fetch(args, connectionInfo)
      .tap(function(response) {
        return utils.updateOauthTokens(connectionInfo);
      })
      .then(function(response) {
        console.log(commandName + ' > response.suppliers.length: ', response.suppliers.length);
        //console.log('response.suppliers: ', JSON.stringify(response.suppliers,vendSdk.replacer,2));

        var filename = 'listSuppliers-' + moment().format('YYYY-MMM-DD_HH-mm-ss') + '.json'; // use local (not UTC) time to save
        console.log(commandName + ' > saving to ' + filename);
        return fileSystem.write(filename, // save to current working directory
          JSON.stringify(response.suppliers,vendSdk.replacer,2));
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListSuppliers;
