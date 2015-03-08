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

// Global variables for interval
var aWeekAgo = moment.utc().subtract(1, 'weeks');
var twoWeeksAgo = moment.utc().subtract(2, 'weeks');
var aMonthAgo = moment.utc().subtract(4, 'weeks');
var sixWeeksAgo = moment.utc().subtract(6, 'weeks');
var twoMonthsAgo = moment.utc().subtract(8, 'weeks');
var intervalOptions = [
  aWeekAgo,
  twoWeeksAgo,
  aMonthAgo,
  sixWeeksAgo,
  twoMonthsAgo
];
var intervalOptionsForDisplay = [
    'Starting a week ago (' + aWeekAgo.format('YYYY-MM-DD') + ')',
    'Starting two weeks ago (' + twoWeeksAgo.format('YYYY-MM-DD') + ')',
    'Starting a month ago (' + aMonthAgo.format('YYYY-MM-DD') + ')',
    'Starting six weeks ago (' + sixWeeksAgo.format('YYYY-MM-DD') + ')',
    'Starting two months ago (' + twoMonthsAgo.format('YYYY-MM-DD') + ')',
    'other'
];

var selectedSupplierName = null;
var stockOrder = null;

// the command's implementation
var GenerateStockOrder = Command.extend({
  desc: 'Generate a stock order in Vend, based on sales history',

  options: { // must not clash with global aliases: -t -d -f
    orderName: {
      type: 'string',
      aliases: ['n']
    },
    outletId: {
      type: 'string',
      aliases: ['o'] // TODO: once Ronin is fixed to accept 2 characters as an alias, use 'oi' alias
    },
    supplierId: {
      type: 'string',
      aliases: ['s'] // TODO: once Ronin is fixed to accept 2 characters as an alias, use 'si' alias
    },
    interval: {
      type: 'string',
      aliases: ['i']
    },
    beginFrom: { // alternative to interval specified as a date in YYYY-MM-DD format
      type: 'string',
      aliases: ['b']
    }
  },

  run: function (orderName, outletId, supplierId, interval, beginFrom) {
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);
    commandName = commandName + '-'+ connectionInfo.domainPrefix;

    if (!orderName) {
      throw new Error('--orderName or -n should be set');
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
        if (beginFrom) {
          return validateBeginFrom(beginFrom);
        }
        else {
        return validateInterval(interval);
        }
      })
      .then(function(since){
        var iORb = (interval) ? (' -i ' + interval) : (' -b ' + since.format('YYYY-MM-DD'));
        console.log('vend-tools ' + commandName +
          ' -n ' + orderName +
          ' -o ' + outletId +
          ' -s ' + supplierId +
            iORb
        );
        runMe(connectionInfo, orderName, outletId, supplierId, since);
      });
  }
});

var validateBeginFrom = function(beginFrom) {
  if (beginFrom) {
    var since = moment.utc(firstDayOfWeek, 'YYYY-MM-DD');
    console.log('validateBeginFrom > since: ' + since);
    console.log('startAnalyzingSalesHistorySince: ' + since.format('YYYY-MM-DD'));
    return Promise.resolve(since);
  }
  else {
    return Promise.reject('--beginFrom or -b should be a date in YYYY-MM-DD format');
  }
};

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
      case '6w':
        since = intervalOptions[3];
        break;
      case '2m':
        since = intervalOptions[4];
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
      if (startAnalyzingSalesHistorySince.toUpperCase() === 'other'.toUpperCase()) {
        return asking.askAsync('Please provide a starting date in YYYY-MM-DD format: ')
          .then(function (resolvedResults) {
            var beginAt = resolvedResults;
            if (beginAt.length!=10){
              return Promise.reject('Invalid input...');
            }
            beginAt = moment.utc(beginAt, 'YYYY-MM-DD');
            console.log('You selected: ' + beginAt.format('YYYY-MM-DD'));
            return(beginAt);
          })
          .catch(function(e) {
            console.error(commandName + ' > An unexpected error occurred: ', e);
            console.log('Try again...');
            return chooseInterval();
          });
      }
      else {
      var since = intervalOptions[indexOfSelectedValue];
      console.log('startAnalyzingSalesHistorySince: ' + since.format('YYYY-MM-DD'));
      return Promise.resolve(since);
      }
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
        //console.log(supplier);
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
      //console.log('suppliers: ', JSON.stringify(suppliers,vendSdk.replacer,2));
      //console.log('supplierDisplayOptions: ' + _.pluck(suppliers,'name'));
      //console.log('supplierOptions: ' + _.pluck(suppliers,'id'));5
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
  return vendSdk.products.fetchAll(connectionInfo)
    .tap(function(products) {
      return utils.exportToJsonFileFormat(commandName, products)
    })
    .then(function(products) {
      console.log(commandName + ' > 1st tap block');
      console.log(commandName + ' > original products.length: ' + products.length);

      // keep only the products that have an inventory field
      // and belong to the store/outlet of interest to us
      // and belong to the supplier of interest to us
      var filteredProducts = _.filter(products, function(product){
        return ( product.inventory &&
                 _.contains(_.pluck(product.inventory,'outlet_id'), outletId) &&
                 selectedSupplierName === product.supplier_name
               );
      });
      console.log(commandName + ' > filtered products.length: ' + filteredProducts.length);

      return utils.exportToJsonFileFormat(commandName+'-filteredProducts', filteredProducts)
        .then(function() {
          return Promise.resolve(filteredProducts);
        });
    })
    .then(function(filteredProducts) {
      // let's dilute the product data even further
      var dilutedProducts = _.object(_.map(filteredProducts, function(product) {
        var neoProduct =  _.pick(product,'name','supply_price');
        neoProduct.inventory = _.find(product.inventory, function(inv){
          return inv.outlet_id === outletId;
        });
        return [product.id, neoProduct];
      }));
      console.log(commandName + ' > diluted products.length: ' + _.keys(dilutedProducts).length);

      return utils.exportToJsonFileFormat(commandName+'-dilutedProducts', dilutedProducts)
    .then(function() {
          return Promise.resolve(dilutedProducts);
        });
    })
    .then(function(dilutedProducts) {
      console.log(commandName + ' > 2nd then block');

      var sinceAsString = since.format('YYYY-MM-DD HH:MM:SS');
      /*console.log('since.format(): ' + since.format()); // by default moment formats it as ISO 8601 which is what Vend wants
      console.log('since.format(\'YYYY-MM-DD HH:MM:SS\'): ' + since.format('YYYY-MM-DD HH:MM:SS'));*/

      var argsForSales = vendSdk.args.sales.fetch();
      argsForSales.since.value = sinceAsString;
      argsForSales.outletApiId.value = outletId;

      return vendSdk.sales.fetchAll(argsForSales,connectionInfo)
        .then(function(sales) {
          console.log('sales.length: ' + sales.length);

          return utils.exportToJsonFileFormat(commandName+'-sales', sales)
            .then(function() {
              var lineitems = _.flatten(_.pluck(sales,'register_sale_products'));
              console.log('lineitems.length: ' + lineitems.length);

              return utils.exportToJsonFileFormat(commandName+'-lineitems', lineitems)
                .then(function() {
                  // tally up a map (productId to count) for the total amount sold
                  // based on sale lineitems and lineitem.quantity etc.
                  var productSales = {};
                  _.each(lineitems, function(lineitem){
                    if (productSales[lineitem.product_id]) {
                      //productSales[lineitem.product_id] += lineitem.quantity;
                      productSales[lineitem.product_id].quantity += lineitem.quantity;
                    }
                    else {
                      //productSales[lineitem.product_id] = lineitem.quantity;
                      productSales[lineitem.product_id] = _.pick(lineitem, 'name', 'quantity');
                    }
        });
                  console.log('productSales.length: ' + _.keys(productSales).length);
                  return utils.exportToJsonFileFormat(commandName+'-productSales', productSales)
                    .then(function() {
                      // iterate over products and generate ConsignmentProducts
                      //       ... do the math based on stock-on-hand (product.inventory.count)
                      //       and stock-sold (productSales.quantity)

                      // (1) reorder quantity (restock_level?) is 0, do nothing
                      //     reorder_point is the level stock must get to before Vend identifies it as 'low stock'
                      //     restock_level is the amount of stock to automatically reorder
                      var discontinuedProducts = {};

                      // (2) No sales history and 30 are still in stock, in a separate stockOrder,
                      //     place order for restock_level if 30 <= reorder_point
                      var productsToOrderBasedOnVendMechanics = {};

                      // (3) 5 sold and 30 still in stock, 5-30=-25, no need to order anymore,
                      //     but still create a 0 quantity line item so retailer may adjust if necessary
                      var productsWithSufficientStockOnHand = {};

                      // (4) 30 sold and -5 still in stock, ignore negative inventory,
                      //     so order 30 more units for the next interval
                      var negativeStockProductsToOrder = {};
                      // (5) 30 sold and 0 still in stock, 30-0=30, order 30 more units for the next interval
                      var zeroStockProductsToOrder = {};
                      // (6) 30 sold and 5 still in stock, 30-5=25, so order 25 more units for the next interval
                      var positiveStockProductsToOrder = {};

                      _.each(dilutedProducts, function(product, productId){
                        if (product.inventory.restock_level==0 /*&& product.inventory.reorder_point==0*/) {
                          discontinuedProducts[productId] = product;
                        }
                        else {
                          var productSalesHistory = productSales[productId];
                          if (productSalesHistory){
                            product.sold = productSalesHistory.quantity;
                            if (product.inventory.count < 0) {
                              // (4) 30 sold and -5 still in stock, ignore negative inventory,
                              //     so order 30 more units for the next interval
                              product.orderMore = productSalesHistory.quantity;
                              negativeStockProductsToOrder[productId] = product;
                            }
                            else {
                              var difference = productSalesHistory.quantity - product.inventory.count;
                              if (difference == 0) {
                                // (5) 30 sold and 0 still in stock, 30-0=30, order 30 more units for the next interval
                                product.orderMore = difference;
                                zeroStockProductsToOrder[productId] = product;
                              }
                              else if (difference > 0){
                                // (6) 30 sold and 5 still in stock, 30-5=25, so order 25 more units for the next interval
                                product.orderMore = difference;
                                positiveStockProductsToOrder[productId] = product;
                              }
                              else {
                                // (3) 5 sold and 30 still in stock, 5-30=-25, no need to order anymore,
                                //     but still create a 0 quantity line item so retailer may adjust if necessary
                                product.orderMore = 0;
                                productsWithSufficientStockOnHand[productId] = product;
                              }
                            }
                          }
                          else {
                            productsToOrderBasedOnVendMechanics[productId] = product;
                          }
                        }
                      });

                      // (4), (5), & (6)
                      var productsToOrderBasedOnSalesData = {};
                      _.extend(productsToOrderBasedOnSalesData,
                        negativeStockProductsToOrder, zeroStockProductsToOrder, positiveStockProductsToOrder);

                      // print the length and then push each array out to a JSON file of its own
                      console.log('discontinuedProducts.length', _.keys(discontinuedProducts).length);
                      console.log('productsWithSufficientStockOnHand.length', _.keys(productsWithSufficientStockOnHand).length);
                      console.log('productsToOrderBasedOnVendMechanics.length', _.keys(productsToOrderBasedOnVendMechanics).length);
                      console.log('negativeStockProductsToOrder.length', _.keys(negativeStockProductsToOrder).length);
                      console.log('zeroStockProductsToOrder.length', _.keys(zeroStockProductsToOrder).length);
                      console.log('positiveStockProductsToOrder.length', _.keys(positiveStockProductsToOrder).length);
                      console.log('productsToOrderBasedOnSalesData.length', _.keys(productsToOrderBasedOnSalesData).length);
                      return utils.exportToJsonFileFormat(commandName+'-x1Disc', discontinuedProducts)
                        .then(function(){
                          return utils.exportToJsonFileFormat(commandName+'-x2Suff', productsWithSufficientStockOnHand)
                        })
                        .then(function(){
                          return utils.exportToJsonFileFormat(commandName+'-x3Vend', productsToOrderBasedOnVendMechanics)
                        })
                        .then(function(){
                          return utils.exportToJsonFileFormat(commandName+'-x4Sales', productsToOrderBasedOnSalesData)
                        })
                        .then(function(){
                          return Promise.resolve([
                            productsWithSufficientStockOnHand,
                            productsToOrderBasedOnVendMechanics,
                            productsToOrderBasedOnSalesData,
                            productSales
                          ]);
                        });
                    });
                });
            });
        });
    })
    .spread(function(productsWithSufficientStockOnHand, productsToOrderBasedOnVendMechanics, productsToOrderBasedOnSalesData, productSales) {
      //console.log(commandName + ' > YYY then block');
      console.log('productsWithSufficientStockOnHand.length', _.keys(productsWithSufficientStockOnHand).length);
      console.log('productsToOrderBasedOnVendMechanics.length', _.keys(productsToOrderBasedOnVendMechanics).length);
      console.log('productsToOrderBasedOnSalesData.length', _.keys(productsToOrderBasedOnSalesData).length);
      console.log('productSales.length: ' + _.keys(productSales).length);

      //TODO: what should be done about productsToOrderBasedOnVendMechanics?
      //      should they be populated? does anyone want this feature?
      //      maybe as a separate stock order?

      // prepare ALL sets of consignmentProducts which will be submitted to Vend
      var orderProducts = _.extend({},productsWithSufficientStockOnHand, productsToOrderBasedOnSalesData);

      var consignmentProductsArray = [];
      productsToOrderBasedOnSalesData = _.sortBy(productsToOrderBasedOnSalesData,function(product){
        return product.name;
      });
      _.each(productsToOrderBasedOnSalesData,function(product, productId){
        consignmentProductsArray.push({
          //'sequence_number': 'Smart',
          'sequence_number': '1', // lets make this code for productsToOrderBasedOnSalesData
          'product_id': productId,
          'count': product.orderMore,
          'cost': product.supply_price
        });
      });
      productsToOrderBasedOnVendMechanics = _.sortBy(productsToOrderBasedOnVendMechanics,function(product){
        return product.name;
      });
      _.each(productsToOrderBasedOnVendMechanics,function(product, productId){
        consignmentProductsArray.push({
          //'sequence_number': 'Vend',
          'sequence_number': '2', // lets make this code for productsToOrderBasedOnVendMechanics
          'product_id': productId,
          'count': product.inventory.restock_level,
          'cost': product.supply_price
        });
      });
      productsWithSufficientStockOnHand = _.sortBy(productsWithSufficientStockOnHand,function(product){
        return product.name;
      });
      _.each(productsWithSufficientStockOnHand,function(product, productId){
        consignmentProductsArray.push({
          //'sequence_number': 'Manual',
          'sequence_number': '3', // lets make this code for productsWithSufficientStockOnHand
          'product_id': productId,
          'count': product.orderMore,
          'cost': product.supply_price
        });
      });
      return utils.exportToJsonFileFormat(commandName+'-x5OrderLong', consignmentProductsArray)
        .then(function(){
          // create a LONG stock order (consignment w/ SUPPLIER)
          var argsForStockOrder = vendSdk.args.consignments.stockOrders.create();
          argsForStockOrder.name.value = orderName + '-long';
          argsForStockOrder.outletId.value = outletId;
          argsForStockOrder.supplierId.value = supplierId;
          return vendSdk.consignments.stockOrders.create(argsForStockOrder, connectionInfo)
        .then(function(newStockOrder) {
          console.log(commandName + ' > ZZZ then block');

          stockOrder = newStockOrder;
          console.log('stockOrder: ', stockOrder);

              // attach stock order to all consignmentProducts
              _.each(consignmentProductsArray,function(consignmentProduct){
                _.extend(consignmentProduct, {'consignment_id':newStockOrder.id});
              });

              // submit the each entry from consignmentProductsArray to Vend
              return Promise.map(
                consignmentProductsArray,
                function(consignmentProduct){
                  return vendSdk.consignments.products.create({body:consignmentProduct}, connectionInfo)
                    .then(function(data){
                      console.log('created consignmentProduct: ', data);
                      return Promise.resolve();
                    })
                },
                {concurrency: 1}
              )
                .then(function(){
                  var accessAtUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com/consignment/' + newStockOrder.id;
                  console.log('You can access your stock order at: ' + accessAtUrl);
                  open(accessAtUrl);
                  return Promise.resolve();
                });
            });
        })
        .then(function() { // create a SHORT stock order (consignment w/ SUPPLIER)
          consignmentProductsArray = []; // empty out the previous array
          _.each(productsToOrderBasedOnSalesData, function (product, productId) {
            consignmentProductsArray.push({
              //'sequence_number': 'Smart', // lets make this code for productsToOrderBasedOnSalesData
              'sequence_number': consignmentProductsArray.length + 1,
              'product_id': productId,
              'count': product.orderMore,
              'cost': product.supply_price
            });
          });
          return utils.exportToJsonFileFormat(commandName+'-x6OrderShort', consignmentProductsArray);
        })
        .then(function(){ // create a SHORT stock order (consignment w/ SUPPLIER)
          var argsForStockOrder = vendSdk.args.consignments.stockOrders.create();
          argsForStockOrder.name.value = orderName + '-short';
          argsForStockOrder.outletId.value = outletId;
          argsForStockOrder.supplierId.value = supplierId;
          return vendSdk.consignments.stockOrders.create(argsForStockOrder, connectionInfo)
            .then(function(newStockOrder) {
              console.log(commandName + ' > ZZZ then block');

              stockOrder = newStockOrder;
              console.log('stockOrder: ', stockOrder);

              // attach stock order to all consignmentProducts
              _.each(consignmentProductsArray,function(consignmentProduct){
                _.extend(consignmentProduct, {'consignment_id':newStockOrder.id});
              });

              // submit the each entry from consignmentProductsArray to Vend
              return Promise.map(
                consignmentProductsArray,
                function(consignmentProduct){
                  return vendSdk.consignments.products.create({body:consignmentProduct}, connectionInfo)
                    .then(function(data){
                      console.log('created consignmentProduct: ', data);
                      return Promise.resolve();
                    })
                },
                {concurrency: 1}
              )
                .then(function(){
                  var accessAtUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com/consignment/' + newStockOrder.id;
                  console.log('You can access your stock order at: ' + accessAtUrl);
                  open(accessAtUrl);
                  return Promise.resolve();
                });
            });
        });
    })
    .catch(function(e) {
      console.error(commandName + ' > An unexpected error occurred: ', e);
    });
};

module.exports = GenerateStockOrder;
