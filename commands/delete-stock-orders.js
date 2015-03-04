var Command = require('ronin').Command;

var Promise = require('bluebird');
var asking = Promise.promisifyAll(require('asking'));

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
//var Promise = require('bluebird');
var _ = require('underscore');
var path = require('path');

// Global variable for logging
var commandName = path.basename(__filename, '.js'); // gives the filename without the .js extension

var DeleteStockOrders = Command.extend({
  desc: 'Delete a Stock Order',

  options: { // must not clash with global aliases: -t -d -f
    status: {
      type: 'string',
      aliases: ['s']
    }
  },

  run: function (status) {
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);

    return fetchStockOrders(status, connectionInfo)
      .then(function(stockOrders){
        if (stockOrders && stockOrders.length>0) {
          return chooseStockOrder(stockOrders)
            .then(function(selectedValue){
              // TODO: do we need to delete any attached products beforehand? or warn the user or something?
              // TODO: is there some way to query for stockOrders that don't have any products attached to them?
              //       or just get a count of what's attached?
              return vendSdk.consignments.stockOrders.remove({apiId:{value:selectedValue}}, connectionInfo);
            });
        }
        else {
          console.log('There aren\'t any stock orders to choose from!');
        }
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

var fetchStockOrders = function(status, connectionInfo){
  return vendSdk.consignments.stockOrders.fetchAll(connectionInfo)
    .tap(function(consignments) {
      return utils.updateOauthTokens(connectionInfo);
    })
    .then(function(consignments) {
      console.log(commandName + ' > consignments.length: ', consignments.length);

      var stockOrders = _.filter(consignments,function(consignment){
        return (
          consignment.type.toUpperCase() === 'SUPPLIER' &&
          // if status was specified, filters on that too
          ((status) ? (consignment.status.toUpperCase() === status.toUpperCase()) : true)
          );
      });
      console.log(commandName + ' > stockOrders.length: ', stockOrders.length);

      return stockOrders;
    })
};

var chooseStockOrder = function(stockOrders){
  var optionsForDisplay = [];
  var options = [];
  _.each(stockOrders, function(stockOrder){
    //_.pluck(stockOrders,'name');
    optionsForDisplay.push(stockOrder.status + ' - ' + stockOrder.name  + ' - ' + stockOrder.consignment_date);
    options.push(stockOrder.id);
  });

  return asking.chooseAsync('Which stock order should be deleted?', optionsForDisplay)
    .then(function (resolvedResults) {
      var userFriendlySelectedValue = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      var systemOrientedSelectedValue = options[indexOfSelectedValue];
      console.log('selectedValue: ' + systemOrientedSelectedValue);
      return Promise.resolve(systemOrientedSelectedValue);
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose an option between 1 - ' + options.length);
      return chooseStockOrder(stockOrders);
    });
};

module.exports = DeleteStockOrders;
