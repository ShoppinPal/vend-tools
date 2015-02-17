var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
//var _ = require('underscore');
var path = require('path');

var GenerateStockOrder = Command.extend({
  desc: 'Generate a stock order in Vend, based on sales history',

  options: {
    token: 'string',
    domain: 'string'
  },

  run: function (token, domain) {
    var commandName = path.basename(__filename, '.js');

    var connectionInfo = utils.loadOauthTokens(token, domain);

    var args = vendSdk.args.consignments.stockOrders.create();
    args.name.value = 'blah';
    args.outletId.value = '123';
    //args.supplierId.value = '123';

    return vendSdk.consignments.stockOrders.create(connectionInfo)
      .then(function(data) {
        console.log(data);
      })
      /*.then(function(products) {
        console.log(commandName + ' > 1st then block');
        return utils.updateOauthTokens(connectionInfo,products);
      })
      .then(function(products) {
        console.log(commandName + ' > 2nd then block');
        return utils.exportToJsonFileFormat('export-all-products', products)
          .then(function() {
            return Promise.resolve(products);
          });
      })
      .then(function(products) {
        console.log(commandName + ' > 3rd then block');
        //console.log(products);

        console.log(commandName + ' > products.length: ', products.length);
        //console.log('products: ', JSON.stringify(products,vendSdk.replacer,2));

        return vendSdk.outlets.fetch({}, connectionInfo)
          .then(function(outletsResponse) {
            //console.log('outletsResponse: ', outletsResponse);
            console.log(commandName + ' > outletsResponse.outlets.length: ', outletsResponse.outlets.length);
            //console.log('outletsResponse.outlets: ' + JSON.stringify(outletsResponse.outlets,vendSdk.replacer,2));

            utils.exportProductsToCsvFileFormat(products, outletsResponse.outlets); // TODO: promisify somehow and then return the promise
            //return Promise.resolve(); // there is no way that this line actually works
          });
      })*/
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = GenerateStockOrder;
