var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
//var Promise = require('bluebird');
var moment = require('moment');
//var _ = require('underscore');

var ListSuppliers = Command.extend({
  desc: 'List All Suppliers',

  options: {
    token: 'string',
    domain: 'string'
  },

  run: function (token, domain) {
    var connectionInfo = utils.loadOauthTokens(token, domain);

    var args = {
      page:{value: 1},
      pageSize:{value: 200}
    };
    return vendSdk.suppliers.fetch(args, connectionInfo)
      .then(function(response) {
        return utils.updateOauthTokens(connectionInfo,response);
      })
      .then(function(response) {
        console.log('response.suppliers.length: ', response.suppliers.length);
        //console.log('response.suppliers: ', JSON.stringify(response.suppliers,vendSdk.replacer,2));

        var filename = 'listSuppliers-' + moment().format('YYYY-MMM-DD-HH:mm:ss') + '.json'; // use local (not UTC) time to save
        console.log('saving to ' + filename);
        return fileSystem.write(filename, // save to current working directory
          JSON.stringify(response.suppliers,vendSdk.replacer,2));
      })
      .catch(function(e) {
        console.error('listSuppliers.js - An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListSuppliers;
