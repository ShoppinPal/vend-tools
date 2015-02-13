var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
//var _ = require('underscore');

var ExportAllProducts = Command.extend({
  desc: 'Export All Products (CSV file format by default)',

  options: {
    token: 'string',
    domain: 'string'
  },

  run: function (token, domain) {
    var connectionInfo = utils.loadOauthTokens(token, domain);

    return vendSdk.products.fetchAll(connectionInfo)
      .then(function(products) {
        console.log('export-all-products.js - 1st then block');
        return utils.updateOauthTokens(connectionInfo,products);
      })
      .then(function(products) {
        console.log('export-all-products.js - 2nd then block');
        return utils.exportProductsToJsonFileFormat(products)
          .then(function() {
            return Promise.resolve(products);
          });
      })
      .then(function(products) {
        console.log('export-all-products.js - 3rd then block');
        //console.log(products);

        console.log('export-all-products.js - products.length: ', products.length);
        //console.log('products: ', JSON.stringify(products,vendSdk.replacer,2));

        return vendSdk.outlets.fetch({}, connectionInfo)
          .then(function(outletsResponse) {
            //console.log('outletsResponse: ', outletsResponse);
            console.log('export-all-products.js - outletsResponse.outlets.length: ', outletsResponse.outlets.length);
            //console.log('outletsResponse.outlets: ' + JSON.stringify(outletsResponse.outlets,vendSdk.replacer,2));

            utils.exportProductsToCsvFileFormat(products, outletsResponse.outlets); // TODO: promisify somehow and then return the promise
            //return Promise.resolve(); // there is no way that this line actually works
          });
      })
      .catch(function(e) {
        console.error('export-all-products.js - An unexpected error occurred: ', e);
      });
  }
});

module.exports = ExportAllProducts;
