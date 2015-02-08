var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var Promise = require('bluebird');
//var _ = require('underscore');

var ListSuppliers = Command.extend({
  desc: 'List All Suppliers',

  options: {
    token: 'string',
    domain: 'string'
  },

  run: function (token, domain) {
    if (!token) {
      throw new Error('--token should be set');
    }
    if (!domain) {
      throw new Error('--domain should be set');
    }

    var connectionInfo = {
      domainPrefix: domain, //nconf.get('domain_prefix'),
      accessToken: token //nconf.get('access_token')
    };
    var args = {
      page:{value: 1},
      pageSize:{value: 200}
    };
    return vendSdk.suppliers.fetch(args, connectionInfo)
      .then(function(response) {
        console.log('response.suppliers.length: ', response.suppliers.length);
        console.log('response.suppliers.length: ', JSON.stringify(response.suppliers,vendSdk.replacer,2));
      })
      .catch(function(e) {
        console.error('listSuppliers.js - An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListSuppliers;
