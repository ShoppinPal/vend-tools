var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var Promise = require('bluebird');
var path = require('path');

var ExportAllSuppliers = Command.extend({
  desc: 'Export All Suppliers (JSON file format by default)',

  options: {
    token: 'string',
    domain: 'string'
  },

  run: function (token, domain) {
    var commandName = path.basename(__filename, '.js');

    var connectionInfo = utils.loadOauthTokens(token, domain);

    return vendSdk.suppliers.fetchAll(connectionInfo)
      .then(function(suppliers) {
        console.log(commandName + ' > 1st then block');
        return utils.updateOauthTokens(connectionInfo,suppliers);
      })
      .then(function(suppliers) {
        console.log(commandName + ' > suppliers.length: ', suppliers.length);
        //console.log('products: ', JSON.stringify(suppliers,vendSdk.replacer,2));

        console.log(commandName + ' > 2nd then block');
        return utils.exportToJsonFileFormat(commandName, suppliers)
          .then(function() {
            return Promise.resolve(suppliers);
          });
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = ExportAllSuppliers;
