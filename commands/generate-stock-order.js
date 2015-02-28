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

// Global variable for logging
var commandName = path.basename(__filename, '.js');

// Global variables for interval
var aWeekAgo = moment.utc().subtract(1, 'weeks');
var twoWeeksAgo = moment.utc().subtract(2, 'weeks');
var aMonthAgo = moment.utc().subtract(1, 'months');
var twoMonthsAgo = moment.utc().subtract(2, 'months');
var intervalOptions = [
  aWeekAgo,
  twoWeeksAgo,
  aMonthAgo,
  twoMonthsAgo
];
var intervalOptionsForDisplay = [
    'Starting a week ago (' + aWeekAgo.format('YYYY-MM-DD') + ')',
    'Starting two weeks ago (' + twoWeeksAgo.format('YYYY-MM-DD') + ')',
    'Starting a month ago (' + aMonthAgo.format('YYYY-MM-DD') + ')',
    'Starting two months ago (' + twoMonthsAgo.format('YYYY-MM-DD') + ')'
];

var selectedSupplierName = null;

// the command's implementation
var GenerateStockOrder = Command.extend({
  desc: 'Generate a stock order in Vend, based on sales history',

  options: {
    orderName: 'string',
    outletId: 'string',
    supplierId: 'string',
    interval: 'string'
  },

  run: function (orderName, outletId, supplierId, interval) {
    var token = this.global.token || this.global.t;
    var domain = this.global.domain || this.global.d;

    var connectionInfo = utils.loadOauthTokens(token, domain);
    if (!orderName) {
      throw new Error('--orderName should be set');
    }
    return validateSupplier(supplierId, connectionInfo)
      .tap(function(resolvedSupplierId) {
        //console.log(commandName + ' > 1st tap block');
        return utils.updateOauthTokens(connectionInfo);
      })
      .then(function(resolvedSupplierId){
        supplierId = resolvedSupplierId;
        return validateOutlet(outletId, connectionInfo);
      })
      .then(function(resolvedOutletId){
        outletId = resolvedOutletId;
        return validateInterval(interval);
      })
      .then(function(since){
        runMe(connectionInfo, orderName, outletId, supplierId, since);
      });
  }
});

var validateInterval = function(interval) {
  if (interval) {
    var since = null;
    switch(interval) {
      case '1w':
        since = intervalOptions[0];
        break;
      case '2w':
        since = intervalOptions[1];
        break;
      case '1m':
        since = intervalOptions[2];
        break;
      case '2m':
        since = intervalOptions[3];
        break;
      default:
        throw new Error('--interval should be set as 1w or 2w or 1m or 2m');
    }
    console.log('startAnalyzingSalesHistorySince: ' + since.format('YYYY-MM-DD'));
    return Promise.resolve(since);
  }
  else {
    return chooseInterval();
  }
};

var chooseInterval = function(){
  return asking.chooseAsync('How far back from today should the sales history be analyzed?', intervalOptionsForDisplay)
    .then(function (resolvedResults/*err, startAnalyzingSalesHistorySince, indexOfSelectedValue*/) {
      var startAnalyzingSalesHistorySince = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      var since = intervalOptions[indexOfSelectedValue];
      console.log('startAnalyzingSalesHistorySince: ' + since.format('YYYY-MM-DD'));
      return Promise.resolve(since);
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose an option between 1 - ' + intervalOptions.length);
      return chooseInterval();
    });
};

var validateSupplier = function(supplierId, connectionInfo) {
  if (supplierId) {
    // we still need to get a supplier name for the given supplierId
    return vendSdk.suppliers.fetchById({apiId:{value:supplierId}},connectionInfo)
      .then(function(supplier){
        console.log(supplier);
        selectedSupplierName = supplier.name;
    return Promise.resolve(supplierId);
      });
  }
  else {
    // if the supplierId isn't specified, prompt the user with a list of user friendly supplier names to choose from
    return fetchSuppliers(connectionInfo)
      .then(function(suppliers){
        return chooseSupplier(suppliers)
          .then(function(selectedValue){
            return Promise.resolve(selectedValue);
          });
      });
  }
};

var fetchSuppliers = function(connectionInfo){
  return vendSdk.suppliers.fetchAll(connectionInfo)
    .then(function(suppliers) {
      console.log(commandName + ' > suppliers.length: ', suppliers.length);
      //console.log('products: ', JSON.stringify(suppliers,vendSdk.replacer,2));
      console.log('supplierDisplayOptions: ' + _.pluck(suppliers,'name'));
      console.log('supplierOptions: ' + _.pluck(suppliers,'id'));5
      console.log('====done with suppliers fetch====');
      return Promise.resolve(suppliers);
    });
};

var chooseSupplier = function(suppliers){
  var supplierOptionsForDisplay = _.pluck(suppliers,'name');
  var supplierOptions = _.pluck(suppliers,'id');

  return asking.chooseAsync('Which supplier?', supplierOptionsForDisplay)
    .then(function (resolvedResults) {
      var userFriendlySelectedValue = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      var systemOrientedSelectedValue = supplierOptions[indexOfSelectedValue];
      console.log('selectedValue: ' + systemOrientedSelectedValue);
      selectedSupplierName = userFriendlySelectedValue;
      return Promise.resolve(systemOrientedSelectedValue);
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose an option between 1 - ' + supplierOptions.length);
      return chooseSupplier(suppliers);
    });
};

var validateOutlet = function(outletId, connectionInfo) {
  if (outletId) {
    return Promise.resolve(outletId);
  }
  else {
    // if the outletId isn't specified, prompt the user with a list of user friendly outlet names to choose from
    return fetchOutlets(connectionInfo)
      .then(function(outlets){
        return chooseOutlet(outlets)
          .then(function(selectedValue){
            return Promise.resolve(selectedValue);
          });
      });
  }
};

var fetchOutlets = function(connectionInfo){
  return vendSdk.outlets.fetch({}, connectionInfo)
    .then(function(outletsResponse) {
      //console.log('outletsResponse: ', outletsResponse);
      console.log('outletsResponse.outlets.length: ', outletsResponse.outlets.length);
      //console.log('outletOptions: ' + _.pluck(outletsResponse.outlets,'id'));
      //console.log('outletOptions: ' + _.pluck(outletsResponse.outlets,'name'));
      console.log('====done with outlets fetch====');
      return Promise.resolve(outletsResponse.outlets);
    });
};

var chooseOutlet = function(outlets){
  var outletOptionsForDisplay = _.pluck(outlets,'name');
  var outletOptions = _.pluck(outlets,'id');

  return asking.chooseAsync('Which outlet?', outletOptionsForDisplay)
    .then(function (resolvedResults) {
      var userFriendlySelectedValue = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      var systemOrientedSelectedValue = outletOptions[indexOfSelectedValue];
      console.log('selectedValue: ' + systemOrientedSelectedValue);
      return Promise.resolve(systemOrientedSelectedValue);
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose an option between 1 - ' + outletOptions.length);
      return chooseOutlet(outlets);
    });
};

var runMe = function(connectionInfo, orderName, outletId, supplierId, since){
  var args = vendSdk.args.consignments.stockOrders.create();
  args.name.value = orderName;
  args.outletId.value = outletId;
  args.supplierId.value = supplierId;

  return vendSdk.consignments.stockOrders.create(args, connectionInfo)
    .then(function(data) {
      console.log(data);
      return vendSdk.products.fetchAll(connectionInfo);
    })
    /*.tap(function(products) {
      console.log(commandName + ' > 1st then block');
      return utils.updateOauthTokens(connectionInfo);
    })*/
    .tap(function(products) {
      console.log(commandName + ' > 2nd then block');
      // keep only the products that have an inventory field
      // and belong to the store/outlet of interest to us
      // and belong to the supplier of interest to us
      products = _.filter(products, function(product){
        return ( product.inventory &&
                 _.contains(_.pluck(product.inventory,'outlet_id'), outletId) &&
                 selectedSupplierName === product.supplier_name
               );
        });
      console.log(commandName + ' > products.length: ' + products.length);
      return utils.exportToJsonFileFormat(commandName, products);
    })
    /*.then(function(products) {
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
};

module.exports = GenerateStockOrder;
