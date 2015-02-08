var Command = require('ronin').Command;
var choose = require('asking').choose;
var ask = require('asking').ask;

var vendSdk = require('vend-nodejs-sdk')({});
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');

var ReportCostsForSuppliers = Command.extend({
  desc: 'Report the costs for each supplier per outlet',

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

    var firstDayOfThisWeek = moment().utc().startOf('week');
    var firstDayOfLastWeek = moment().utc().startOf('week').subtract(7, 'days');
    var firstDayOfWeekBeforeLast = moment().utc().startOf('week').subtract(14, 'days');

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
              console.log('You selected: ' + customFirstDayOfWeek);
              runReport(connectionInfo, firstDayOfWeek);
            }
          });
        }
        else {
          console.log('You selected: ' + firstDayOfWeek);
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
      console.log('customProcessPagedResults - pagedData.consignments.length: ', pagedData.consignments.length);
      console.log('customProcessPagedResults - pagedData.consignments.length: ', pagedData.consignments.length);
      var moment = require('moment');
      var startDate = moment.utc(firstDayOfWeek, 'YYYY-MM-DD');
      var endDate = moment.utc(firstDayOfWeek, 'YYYY-MM-DD').add(7, 'days');
      console.log('customProcessPagedResults - startDate: ', startDate.format());
      console.log('customProcessPagedResults - endDate: ', endDate.format());
      var consignmentsAfterDateX = _.filter(pagedData.consignments, function(consignment){
        if(consignment.received_at) {
          console.log('customProcessPagedResults - consignment.received_at: ', consignment.received_at);
          var receivedAt = moment.utc(consignment.received_at);
          console.log('customProcessPagedResults - receivedAt: ', receivedAt.format());
        }
        return consignment.received_at &&
          receivedAt.isAfter(startDate) &&
          receivedAt.isBefore(endDate) &&
          consignment.type === 'SUPPLIER'; //&& consignment.supplier_id;
      });
      console.log('customProcessPagedResults - consignmentsAfterDateX: ', consignmentsAfterDateX.length);
      //console.log('consignmentsAfterDateX: ', consignmentsAfterDateX);

      if (previousData && previousData.length>0){
        if (consignmentsAfterDateX.length>0) {
          console.log('customProcessPagedResults - previousData.length: ', previousData.length);
          consignmentsAfterDateX = consignmentsAfterDateX.concat(previousData);
          console.log('customProcessPagedResults - combinedData.length: ', consignmentsAfterDateX.length);
        }
        else {
          consignmentsAfterDateX = previousData;
        }
      }
      console.log('customProcessPagedResults - finalData.length: ', consignmentsAfterDateX.length);
      return Promise.resolve(consignmentsAfterDateX); // why do we need a promise?
    })
    .then(function(allConsignmentsAfterDateX){
      //console.log('allConsignmentsAfterDateX: ', allConsignmentsAfterDateX);
      console.log('allConsignmentsAfterDateX.length: ', allConsignmentsAfterDateX.length);
      console.log('====done with example 3====');

      if (allConsignmentsAfterDateX.length > 0) {
        // (5) example: iterate through a collection of consignments and get consignment products for all of them together
        return vendSdk.consignments.products.fetchAllForConsignments({
            consignmentIds: {value: _.pluck(allConsignmentsAfterDateX, 'id')}
          },
          connectionInfo
        )
          .then(function(allProductsForConsignments){
            console.log('====done with example 4====');
            //console.log('response: ', allProductsForConsignments);

            var consignmentsMap = _.object(_.map(allConsignmentsAfterDateX, function(consignment) {
              return [consignment.id, consignment]
            }));

            var costPerOutletPerSupplier = {};

            // NOTE: each consignment is mapped to exactly one supplier_id and one outlet_id

            // sum the costs per outlet per supplier
            _.each(allProductsForConsignments, function(consignmentProduct){
              var outletId = consignmentsMap[consignmentProduct.consignment_id].outlet_id;
              var supplierId = consignmentsMap[consignmentProduct.consignment_id].supplier_id;
              console.log('outletId: ' + outletId + ' supplier_id: ' + supplierId);
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
            //console.log(consignmentsMap);
            // TODO: add names for outlets
            //console.log(costPerOutletPerSupplier);
            return Promise.resolve(costPerOutletPerSupplier);
          })
          .then(function(costPerOutletPerSupplier){
            return vendSdk.outlets.fetch({}, connectionInfo)
              .then(function(outletsResponse) {
                //console.log('outletsResponse: ', outletsResponse);
                console.log('outletsResponse.outlets.length: ', outletsResponse.outlets.length);
                var outletsMap = _.object(_.map(outletsResponse.outlets, function(outlet) {
                  return [outlet.id, outlet];
                }));
                console.log('outletsMap: ' + JSON.stringify(outletsMap,vendSdk.replacer,2));

                console.log('====done with outlets fetch====');
                var args = {
                  page:{value: 1},
                  pageSize:{value: 200}
                }
                return vendSdk.suppliers.fetch(args, connectionInfo)
                  .then(function(suppliersResponse) {
                    //console.log('suppliersResponse: ', suppliersResponse);
                    console.log('suppliersResponse.suppliers.length: ', suppliersResponse.suppliers.length);
                    var suppliersMap = _.object(_.map(suppliersResponse.suppliers, function(supplier) {
                      return [supplier.id, supplier];
                    }));

                    //pagination info, if any
                    console.log('suppliersResponse.results: ' + suppliersResponse.results);
                    console.log('suppliersResponse.page: ' + suppliersResponse.page);
                    console.log('suppliersResponse.page_size: ' + suppliersResponse.page_size);
                    console.log('suppliersResponse.pages: ' + suppliersResponse.pages);
                    // TODO: fetchAll suppliers, not piece-meal, otherwise you're just looking at the first 200
                    console.log('====done with suppliers fetch====');

                    // cross reference IDs with friendly-names for outlets and suppliers
                    var newCostPerOutletPerSupplier = {};
                    _.each(costPerOutletPerSupplier, function(outletWithSuppliers, outletId, list){
                      newCostPerOutletPerSupplier[outletsMap[outletId].name] = {};
                      _.each(outletWithSuppliers, function(supplierWithCosts, supplierId, list){
                        if (supplierId && suppliersMap[supplierId]) { // null sneaks in somehow?
                          //supplierWithCosts.name = suppliersMap[supplierId].name;
                          newCostPerOutletPerSupplier[outletsMap[outletId].name][suppliersMap[supplierId].name] = supplierWithCosts;
                        }
                        else {
                          console.error('cannot lookup supplier: ' + supplierId);
                          newCostPerOutletPerSupplier[outletsMap[outletId].name][supplierId] = supplierWithCosts;
                        }
                      });
                    });
                    console.log(JSON.stringify(newCostPerOutletPerSupplier,vendSdk.replacer,2));
                  })
              })
          });
      }
      else {
        console.log('There aren\'t any consignments that were received after ' + firstDayOfWeek);
      }
    })
    .catch(function(e) {
      console.error('report-costs-for-suppliers.js - An unexpected error occurred: ', e);
    });
};

module.exports = ReportCostsForSuppliers;
