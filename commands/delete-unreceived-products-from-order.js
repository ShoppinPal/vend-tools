var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');
var path = require('path');

var DeleteUnreceivedProductsFromOrder = Command.extend({
  desc: 'Delete consignment products for a specific order with receive qty 0',

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

          return Promise.map(
            receiveQtyZeroConsignmentProducts,
            function(singleConsignmentProductToDelete){
              var argsToDeleteConsignmentProduct = {apiId:{value : singleConsignmentProductToDelete.consignmentProduct.id}};
              return vendSdk.consignments.products.remove(argsToDeleteConsignmentProduct,connectionInfo)
                .then(function deletionResult(result){
                  
                  if(result.status=="success"){
                    deletedConsignmentProductsCount += 1;
                    singleConsignmentProductToDelete.consignmentProductScriptState = 'Deleted';
                  }
                  else{
                    singleConsignmentProductToDelete.consignmentProductScriptState = 'NotDeleted';
                  }
                  return Promise.resolve();
                })
                .catch(function(error){
                  console.log(commandName + 'Error while deleting consignment product.\n'+error);
                  return Promise.reject(commandName + 'Error while deleting consignment product.\n'+error);
                })
            },
            {concurrency:1}
            )
            .then(function(){

              if(receiveQtyZeroConsignmentProductsCount == deletedConsignmentProductsCount){

                var argsForMarkingReceived = {apiId:{value : singleConsignment.id},body:{value:singleConsignment}};

                return vendSdk.consignments.stockOrders.markAsReceived(argsForMarkingReceived,connectionInfo)
                  .then(function(markingResult){
                    console.log(markingResult);
                    if(markingResult.status == 'RECEIVED'){
                      return utils.exportToJsonFileFormat(commandName,receiveQtyZeroConsignmentProducts);
                    }
                    else{
                      console.log(commandName + 'Consignment not marked as received.\n'+ singleConsignment.id);
                    }
                  })
                  .catch(function(error){
                    console.log(commandName + 'Error while marking consignment as received.\n'+error);
                    return Promise.reject(commandName + 'Error while marking consignment as received.\n'+error);
                  });
              }
              else{
                console.log('All receive qty zero consignment products not deleted.');
                return Promise.reject('All receive qty zero consignment products not deleted.');
              }
                
            })
            .catch(function(error){
              console.log(commandName + ' > An unexpected error occurred: ', error);
              return Promise.reject(commandName + ' > An unexpected error occurred: ', error);
            }) 
          
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

module.exports = DeleteUnreceivedProductsFromOrder;
