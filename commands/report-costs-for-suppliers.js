var Command = require('ronin').Command;
var choose = require('asking').choose;
var ask = require('asking').ask;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');

var path = require('path');
var commandName = path.basename(__filename, '.js');
var logger = console;

var ReportCostsForSuppliers = Command.extend({
  desc: 'Report the costs for each supplier per outlet',

  options: {
  },

  run: function () {
    if(this.global.debug) {
      logger = require('tracer').console();
    }
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);

    // etc.
    var firstDayOfThisWeek = moment.utc().startOf('week');
    var firstDayOfLastWeek = moment.utc().startOf('week').subtract(7, 'days');
    var firstDayOfWeekBeforeLast = moment.utc().startOf('week').subtract(14, 'days');

    choose('Select the first day of a week (YYYY-MM-DD) for which this report should run: ', [
      firstDayOfThisWeek.format('YYYY-MM-DD'),
      firstDayOfLastWeek.format('YYYY-MM-DD'),
      firstDayOfWeekBeforeLast.format('YYYY-MM-DD'),
      'other'
    ], function (err, firstDayOfWeek, index) {
      if (err) {
        throw err;
      }
      else {
        if (firstDayOfWeek.toUpperCase() === 'other'.toUpperCase()) {
          ask('Please provide the first day of a week for which this report should run in YYYY-MM-DD format:', function (err, customFirstDayOfWeek) {
            if (err) {
              throw err;
            }
            else {
              logger.log('You selected: ' + customFirstDayOfWeek);
              runReport(connectionInfo, customFirstDayOfWeek);
            }
          });
        }
        else {
          logger.log('You selected: ' + firstDayOfWeek);
          runReport(connectionInfo, firstDayOfWeek);
        }
      }
    });

  }
});

var runReport = function(connectionInfo, firstDayOfWeek){
  // (3) example: fetch all SUPPLIER consignments that were received after firstDayOfWeek
  return vendSdk.consignments.stockOrders.fetchAll(
    connectionInfo,
    function customProcessPagedResults(pagedData, previousData){ // example of how to REDUCE paged data in a custom fashion
      logger.log('customProcessPagedResults - pagedData.consignments.length: ', pagedData.consignments.length);
      logger.log('customProcessPagedResults - pagedData.consignments.length: ', pagedData.consignments.length);
      var startDate = moment.utc(firstDayOfWeek, 'YYYY-MM-DD');
      var endDate = moment.utc(firstDayOfWeek, 'YYYY-MM-DD').add(7, 'days');
      logger.log('customProcessPagedResults - startDate: ', startDate.format());
      logger.log('customProcessPagedResults - endDate: ', endDate.format());
      var consignmentsAfterDateX = _.filter(pagedData.consignments, function(consignment){
        logger.log('customProcessPagedResults' +
          ' - consignment.type: ' + consignment.type +
          ' - consignment.received_at: ' + consignment.received_at);
        var receivedAt = null;
        if(consignment.received_at) {
          receivedAt = moment.utc(consignment.received_at);
          //logger.log('customProcessPagedResults - receivedAt UTC format: ', receivedAt.format());
        }
        return consignment.received_at &&
          receivedAt.isAfter(startDate) &&
          receivedAt.isBefore(endDate) &&
          consignment.type === 'SUPPLIER'; //&& consignment.supplier_id;
      });
      logger.log('customProcessPagedResults - consignmentsAfterDateX: ', consignmentsAfterDateX.length);
      //logger.log('consignmentsAfterDateX: ', consignmentsAfterDateX);

      if (previousData && previousData.length>0){
        if (consignmentsAfterDateX.length>0) {
          logger.log('customProcessPagedResults - previousData.length: ', previousData.length);
          consignmentsAfterDateX = consignmentsAfterDateX.concat(previousData);
          logger.log('customProcessPagedResults - combinedData.length: ', consignmentsAfterDateX.length);
        }
        else {
          consignmentsAfterDateX = previousData;
        }
      }
      logger.log('customProcessPagedResults - finalData.length: ', consignmentsAfterDateX.length);
      return Promise.resolve(consignmentsAfterDateX); // why do we need a promise?
    })
    .then(function(allConsignmentsAfterDateX){
      //logger.log('allConsignmentsAfterDateX: ', allConsignmentsAfterDateX);
      logger.log('allConsignmentsAfterDateX.length: ', allConsignmentsAfterDateX.length);
      logger.log('====done with example 3====');

      if (allConsignmentsAfterDateX.length > 0) {
        // (5) example: iterate through a collection of consignments and get consignment products for all of them together
        return vendSdk.consignments.products.fetchAllForConsignments({
            consignmentIds: {value: _.pluck(allConsignmentsAfterDateX, 'id')}
          },
          connectionInfo
        )
          .then(function(allProductsForConsignments){
            // NOTE: if a supplier_id is missing then check the product's supplier
            //       for either "supplier_name" or "supplier_code" so as to replace
            //       the missing id

            var consignmentsMap = _.object(_.map(allConsignmentsAfterDateX, function(consignment) {
              return [consignment.id, consignment]
            }));
            //logger.log('consignmentsMap: ', consignmentsMap);

            // (1) iterate through a consignmentsMap and identify all the consignmentsWithoutSupplierId
            var consignmentsWithoutSupplierId = {};
            var numberOfConsignmentsWithoutSupplierId = 0;
            _.each(consignmentsMap, function(consignment, consignmentId, list){
              if (!consignment.supplier_id) {
                consignmentsWithoutSupplierId[consignmentId] = consignment;
                numberOfConsignmentsWithoutSupplierId++;
              }
            });
            logger.log('numberOfConsignmentsWithoutSupplierId: ', numberOfConsignmentsWithoutSupplierId);

            // finish early if there isn't a need to pad any missing data
            if(numberOfConsignmentsWithoutSupplierId === 0) {
              return Promise.resolve([allProductsForConsignments, consignmentsMap]);
            }

            // then iterate through allProductsForConsignments and jot down one product.id for each of these consignmentsWithoutSupplierId
            var consignmentIdToProductIdMap = [];
            _.each(consignmentsWithoutSupplierId, function(consignment, consignmentId, list){
              var consignmentProduct = _.find(allProductsForConsignments, function(consignmentProduct){
                return consignmentProduct.consignment_id === consignmentId;
              });
              if (consignmentProduct) {
                consignmentIdToProductIdMap.push({
                  consignmentId: consignmentId,
                  productId: consignmentProduct.product_id
                });
                //consignmentIdToProductIdMap[consignmentId] = consignmentProduct.id;
                //consignment.randomProductId = consignmentProduct.id;
              }
            });
            logger.log('consignmentIdToProductIdMap: ', consignmentIdToProductIdMap);

            // then serially fetch & populate a supplier field with the result from a product API call ...
            return vendSdk.consignments.stockOrders.resolveMissingSuppliers({consignmentIdToProductIdMap: {value:consignmentIdToProductIdMap}}, connectionInfo)
              .then(function(updatedConsignmentIdToProductIdMap){
                logger.log(updatedConsignmentIdToProductIdMap);
                // into its respective consignment in consignmentsWithoutSupplierId ...
                // make sure that the values are also cross populated into the original consignmentsMap
                _.each(updatedConsignmentIdToProductIdMap, function(consignmentAndProductAndSupplier){
                  // what we have is a name or code for supplier so we won't fill it into supplier_id
                  consignmentsMap[consignmentAndProductAndSupplier.consignmentId].supplier = consignmentAndProductAndSupplier.supplier;
                });
                //logger.log('consignmentsMap: ', consignmentsMap);

                return Promise.resolve([allProductsForConsignments, consignmentsMap]);
              });
          })
          .then(function(resolvedArray){
            var allProductsForConsignments = resolvedArray[0];
            var consignmentsMap = resolvedArray[1];
            logger.log('====done with example 4====');
            //logger.log('response: ', allProductsForConsignments);


            // sum the costs per outlet per supplier
            var costPerOutletPerSupplier = {};
            _.each(allProductsForConsignments, function(consignmentProduct){
              // NOTE: each consignment is mapped to exactly one supplier_id and one outlet_id
              var outletId = consignmentsMap[consignmentProduct.consignment_id].outlet_id;
              var supplierId = consignmentsMap[consignmentProduct.consignment_id].supplier_id || consignmentsMap[consignmentProduct.consignment_id].supplier;
              logger.log('outletId: ' + outletId + ' supplier_id: ' + supplierId);
              if (!costPerOutletPerSupplier[outletId]) {
                costPerOutletPerSupplier[outletId] = {};
              }
              if (!costPerOutletPerSupplier[outletId][supplierId]) {
                costPerOutletPerSupplier[outletId][supplierId] = {
                  products: 0
                };
              }
              if (!costPerOutletPerSupplier[outletId][supplierId]['cost']) {
                costPerOutletPerSupplier[outletId][supplierId]['cost'] = 0.0;
              }
              if (!costPerOutletPerSupplier[outletId][supplierId]['reverseOrdersCost']) {
                costPerOutletPerSupplier[outletId][supplierId]['reverseOrdersCost'] = 0.0;
              }
              if(consignmentProduct.received < 0) {
                var reverseOrdersCost = consignmentProduct.cost * consignmentProduct.received;
                costPerOutletPerSupplier[outletId][supplierId]['reverseOrdersCost'] += reverseOrdersCost;
                costPerOutletPerSupplier[outletId][supplierId]['products']++;
              }
              else {
                var cost = consignmentProduct.cost * consignmentProduct.received;
                costPerOutletPerSupplier[outletId][supplierId]['cost'] += cost;
                costPerOutletPerSupplier[outletId][supplierId]['products']++;
              }
            });
            //logger.log(consignmentsMap);
            //logger.log(costPerOutletPerSupplier);
            return Promise.resolve(costPerOutletPerSupplier);
          })
          .then(function(costPerOutletPerSupplier){
            return vendSdk.outlets.fetch({}, connectionInfo)
              .then(function(outletsResponse) {
                //logger.log('outletsResponse: ', outletsResponse);
                logger.log('outletsResponse.outlets.length: ', outletsResponse.outlets.length);
                var outletsMap = _.object(_.map(outletsResponse.outlets, function(outlet) {
                  return [outlet.id, outlet];
                }));
                //logger.log('outletsMap: ' + JSON.stringify(outletsMap,vendSdk.replacer,2));

                logger.log('====done with outlets fetch====');
                var args = {
                  page:{value: 1},
                  pageSize:{value: 200}
                };
                return vendSdk.suppliers.fetch(args, connectionInfo)
                  .then(function(suppliersResponse) {
                    //logger.log('suppliersResponse: ', suppliersResponse);
                    logger.log('suppliersResponse.suppliers.length: ', suppliersResponse.suppliers.length);
                    var suppliersMap = _.object(_.map(suppliersResponse.suppliers, function(supplier) {
                      return [supplier.id, supplier];
                    }));

                    //pagination info, if any
                    logger.log('suppliersResponse.results: ' + suppliersResponse.results);
                    logger.log('suppliersResponse.page: ' + suppliersResponse.page);
                    logger.log('suppliersResponse.page_size: ' + suppliersResponse.page_size);
                    logger.log('suppliersResponse.pages: ' + suppliersResponse.pages);
                    // TODO: fetchAll suppliers, not piece-meal, otherwise you're just looking at the first 200
                    logger.log('====done with suppliers fetch====');

                    // cross reference IDs with friendly-names for outlets and suppliers
                    var newCostPerOutletPerSupplier = {};
                    _.each(costPerOutletPerSupplier, function(outletWithSuppliers, outletId, list){
                      newCostPerOutletPerSupplier[outletsMap[outletId].name] = {};
                      _.each(outletWithSuppliers, function(supplierWithCosts, supplierId, list){
                        // TODO: for missing supplier IDs, maybe supplierName was set directly earlier via product lookup?
                        if (supplierId && suppliersMap[supplierId]) { // null sneaks in somehow?
                          newCostPerOutletPerSupplier[outletsMap[outletId].name][suppliersMap[supplierId].name] = supplierWithCosts;
                        }
                        else {
                          console.error('cannot lookup supplier: ' + supplierId);
                          if (newCostPerOutletPerSupplier[outletsMap[outletId].name][supplierId]) {
                            newCostPerOutletPerSupplier[outletsMap[outletId].name][supplierId] = merge(supplierWithCosts, newCostPerOutletPerSupplier[outletsMap[outletId].name][supplierId]);
                          }
                          else {
                            newCostPerOutletPerSupplier[outletsMap[outletId].name][supplierId] = supplierWithCosts;
                          }
                        }
                      });
                    });
                    logger.log(JSON.stringify(newCostPerOutletPerSupplier,vendSdk.replacer,2));

                    logger.log('saving to ' + 'report-for-' + firstDayOfWeek + '.json');
                    return fileSystem.write(
                      'report-for-' + firstDayOfWeek + '.json',
                      JSON.stringify(newCostPerOutletPerSupplier,vendSdk.replacer,2));
                  })
              })
          });
      }
      else {
        logger.log('There aren\'t any consignments that were received after ' + firstDayOfWeek);
      }
    })
    .then(function() {
      //logger.log('updating oauth.json ... in case there might have been changes');
      //logger.log('Vend Token Details ' + JSON.stringify(connectionInfo,null,2));
      return fileSystem.write(
        'oauth.json',
        JSON.stringify({
          'access_token': connectionInfo.accessToken,
          'token_type': 'Bearer',
          'refresh_token': connectionInfo.refreshToken,
          'domain_prefix': connectionInfo.domainPrefix
        },null,2));
    })
    .catch(function(e) {
      console.error('report-costs-for-suppliers.js - An unexpected error occurred: ', e);
    });
};

var merge = function(supplierWithCostsA, supplierWithCostsB){
  return {
    'products': supplierWithCostsA.products + supplierWithCostsB.products,
    'cost': supplierWithCostsA.cost + supplierWithCostsB.cost,
    'reverseOrdersCost': supplierWithCostsA.reverseOrdersCost + supplierWithCostsB.reverseOrdersCost
  };
};

module.exports = ReportCostsForSuppliers;
