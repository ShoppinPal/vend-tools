var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');
var path = require('path');

var ListStockOrdersWithBadLineitems = Command.extend({
  desc: 'List StockOrders (consignments) that have lineitems (consignment products) with bad data (receive qty 0)',

  options: {},

  run: function () {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token;
    var domain = this.global.domain;

    var status = 'SENT'; // only interested in consignments that get stuck in SENT state due to bad data (receive qty 0)
    var type = 'SUPPLIER'; // only interested in consignments that are StockOrders
    if(!status || !type){
      throw new Error('--status and --type should be set');
    }

    var connectionInfo = utils.loadOauthTokens(token, domain);
    //var consignments = require('../downloadedConsignments.json');

    return vendSdk.consignments.stockOrders.fetchAll(connectionInfo)
      .tap(function(response) {
        return utils.updateOauthTokens(connectionInfo);
      })
      .then(function(consignments) {
        if (consignments) {
          var filteredConsignments = _.where(consignments,{"status":status,"type":type});
          var lastSunday = moment().day(-7).format('YYYY-MM-DD HH:mm:ss');
          var dateFilteredConsignments = _.filter(filteredConsignments,function(singleConsignment){
            var momentResult = moment(singleConsignment.consignment_date).isBefore(lastSunday);
            return momentResult;
          });
          console.log(commandName + '\n\n\n\n Number of consignments to mark as received are : '+ dateFilteredConsignments.length+"\n\n\n\n");
          return utils.exportToJsonFileFormat(commandName+'-1', dateFilteredConsignments)
            .then(function(){
              return Promise.map(
                dateFilteredConsignments,
                function(singleConsignment){
                  var receiveQtyZeroConsignmentProducts = [];
                  var receiveQtyZeroConsignmentProductsCount = 0;
                  var deletedConsignmentProductsCount = 0;
                  var argsForConsignmentProduct = {
                    consignmentId : {required: true,key: 'consignment_id', value : singleConsignment.id}
                  };
                  return vendSdk.consignments.products.fetchAllByConsignment(argsForConsignmentProduct,connectionInfo)
                    .then(function(consignmentProducts) {
                      consignmentProducts.forEach(function(singleConsignmentProduct){
                        if((singleConsignmentProduct.received == undefined || singleConsignmentProduct.received == 0)){
                          receiveQtyZeroConsignmentProductsCount += 1;  
                          receiveQtyZeroConsignmentProducts.push({'consignmentProduct':singleConsignmentProduct,'consignmentProductScriptState':'identified'});
                        }
                      });
                      return utils.exportToJsonFileFormat(commandName+'-2'+'-'+singleConsignment.id, receiveQtyZeroConsignmentProducts);
                    })
                    .catch(function(error){
                      console.log(commandName + 'Error while fetching consignment products.\n'+error);
                      return Promise.reject(commandName + 'Error while fetching consignment products.\n'+error);
                    });
                },
                {concurrency:1}
              )
                .then(function(){
                  console.log("Done processing.");
                  return Promise.resolve();
                });
            })
            .catch(function(error){
              console.log(commandName + ' > An unexpected error occurred: ', error);
              return Promise.reject(commandName + ' > An unexpected error occurred: ', error);
            }); 
        }
        else {
          console.log(commandName + ' > No matching result(s) were found.');
          return Promise.resolve();
        }
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListStockOrdersWithBadLineitems;
