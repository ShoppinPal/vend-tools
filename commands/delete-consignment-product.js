var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');
var path = require('path');

var DeleteConsignmentProduct = Command.extend({
  desc: 'Delete consignment products with receive qty 0',

  options: {
    status: 'string',
    type: 'string'
  },

  run: function (status,type) {
    var commandName = path.basename(__filename, '.js');

    if(!status || !type){
      throw new Error('--status and --type should be set');
    }

    var connectionInfo = utils.loadOauthTokens();
    //var consignments = require('../downloadedConsignments.json');
    var receiveQtyZeroConsignmentProducts = [];
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
          
          return Promise.map(
            dateFilteredConsignments,
            function(singleConsignment){

              
              var receiveQtyZeroConsignmentProductsCount = 0;
              var deletedConsignmentProductsCount = 0;
              var argsForConsignmentProduct = {
                consignmentId : {required: true,key: 'consignment_id', value : singleConsignment.id}
              };
              
              return vendSdk.consignments.products.fetchAllByConsignment(argsForConsignmentProduct,connectionInfo)
              .then(function(consignmentProducts) {
                
                receiveQtyZeroConsignmentProducts.push(consignmentProducts);
                /*consignmentProducts.forEach(function(singleConsignmentProduct){
                  if(parseFloat(singleConsignmentProduct.count) > 0 && singleConsignmentProduct.received == undefined){
                    receiveQtyZeroConsignmentProductsCount += 1;  
                    receiveQtyZeroConsignmentProducts.push({'consignmentProduct':singleConsignmentProduct,'consignmentProductScriptState':'identified'});
                  }
                });*/
                
                /*return Promise.map(
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
                */
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
              return utils.exportToJsonFileFormat(commandName,receiveQtyZeroConsignmentProducts);
            })
            .catch(function(error){
              console.log(commandName + ' > An unexpected error occurred: ', error);
              return Promise.reject(commandName + ' > An unexpected error occurred: ', error);
            }) 
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

module.exports = DeleteConsignmentProduct;
