var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');
var path = require('path');

var ListUnreceivedProductsFromOrder = Command.extend({
  desc: 'List consignment products for a specific StockOrder with receive qty 0',

  options: {
    consignmentId: 'string'
  },

  run: function (consignmentId) {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token;
    var domain = this.global.domain;

    if(!consignmentId){
      throw new Error('--consignmentId should be set');
    }

    var connectionInfo = utils.loadOauthTokens(token, domain);

    var args = vendSdk.args.consignments.fetchById();
    args.apiId.value = consignmentId;
    return vendSdk.consignments.fetchById(args, connectionInfo)
    .then(function(consignment){

      return Promise.map(
      [consignment],
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
              if (!singleConsignmentProduct.count || parseFloat(singleConsignmentProduct.count) <= 0) {
                console.log('\nWARN: HOW WOULD ONE GET IN SUCH A SITUATION?\n', singleConsignmentProduct);
              }
              else if (
                singleConsignmentProduct.received === undefined ||
                singleConsignmentProduct.received === null ||
                singleConsignmentProduct.received === 0
              ) {
                receiveQtyZeroConsignmentProductsCount += 1;
                receiveQtyZeroConsignmentProducts.push({'consignmentProduct':singleConsignmentProduct,'consignmentProductScriptState':'identified'});
              }
            });
            console.log(receiveQtyZeroConsignmentProducts);
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
      })
      .catch(function(error){
        console.log(commandName + ' > An unexpected error occurred: ', error);
        return Promise.reject(commandName + ' > An unexpected error occurred: ', error);
      });

    });
  }
});

module.exports = ListUnreceivedProductsFromOrder;
