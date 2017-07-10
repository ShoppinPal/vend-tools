var Command = require('ronin').Command;

var Promise = require('bluebird');
var asking = Promise.promisifyAll(require('asking'));
//var choose = require('asking').choose;
//var ask = require('asking').ask;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');

var moment = require('moment');
var _ = require('underscore');
var path = require('path');
var open = require('open');

// Global variable for logging
var commandName = path.basename(__filename, '.js'); // gives the filename without the .js extension

// the command's implementation
var ListProductsPerOutletPerSupplier = Command.extend({
  desc: 'Lists the products by grouping them per outlet per supplier',

  options: { // must not clash with global aliases: -t -d -f
  },

  run: function () {
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);
    commandName = commandName + '-'+ connectionInfo.domainPrefix;

    return runMe(connectionInfo);
  }
});

var fetchSuppliers = function(connectionInfo){
  return vendSdk.suppliers.fetchAll(connectionInfo)
    .then(function(suppliers) {
      console.log('====done with suppliers fetch====');
      return Promise.resolve(suppliers);
    });
};

var fetchOutlets = function(connectionInfo){
  var args = vendSdk.args.outlets.fetch();
  return vendSdk.outlets.fetch(args, connectionInfo)
    .then(function(outletsResponse) {
      console.log('====done with outlets fetch====');
      return Promise.resolve(outletsResponse.outlets);
    });
};

/**
 * Keep only the products that:
 *    - have an inventory field
 *    - and belong to the store/outlet of interest to us
 *    - and belong to the supplier of interest to us
 */
var filterProductsByOutletAndSupplier = function(outlet, supplier, products){
  var selectedSupplierName = supplier.name;
  var selectedOutletName = outlet.name;
  outletId = outlet.id;
  supplierId = supplier.id;
  console.log(commandName + ' > filtering for supplier ' + selectedSupplierName + ' and outlet ' + selectedOutletName);
  var filteredProducts = _.filter(products, function(product){
    return ( product.inventory &&
              _.contains(_.pluck(product.inventory,'outlet_id'), outletId) &&
              selectedSupplierName === product.supplier_name
            );
  });
  console.log(commandName + ' > filtered products.length: ' + filteredProducts.length);
  /*return utils.exportToJsonFileFormat(commandName+'-'+outletId+'-'+supplierId, filteredProducts)
    .then(function() {
      return Promise.resolve(filteredProducts);
    });*/
  return Promise.resolve();
};

var runMe = function(connectionInfo){

  var allOutlets, allSuppliers, allProducts;

  return vendSdk.products.fetchAll(connectionInfo)
    .then(function(products) {
      allProducts = products;
      console.log(commandName + ' > total products: ' + allProducts.length);
      return fetchOutlets(connectionInfo);
    })
    .then(function(outlets) {
      allOutlets = outlets;
      console.log(commandName + ' > total outlets: ' + allOutlets.length);
      return fetchSuppliers(connectionInfo);
    })
    .then(function(suppliers) {
      allSuppliers = suppliers;
      console.log(commandName + ' > total suppliers: ' + allSuppliers.length);
      return Promise.resolve();
    })
    .then(function() {
      return Promise.map(
        allOutlets,
        function (outlet) {
          return Promise.map(
            allSuppliers,
            function (supplier) {
              return filterProductsByOutletAndSupplier(outlet, supplier, allProducts);
            },
            {concurrency: 1}
          );
        },
        {concurrency: 1}
      );
    })
    .catch(function(e) {
      console.error(commandName + ' > An unexpected error occurred: ', e);
    });
};

module.exports = ListProductsPerOutletPerSupplier;
