var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
//var Promise = require('bluebird');
var _ = require('underscore');
var path = require('path');

var ListStockOrders = Command.extend({
  desc: 'List All Stock Orders',

  options: { // must not clash with global aliases: -t -d -f
    status: {
      type: 'string',
      aliases: ['s']
    }
  },

  run: function (status) {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);

    var args = {
      page:{value: 1},
      pageSize:{value: 200}
    };
    return vendSdk.consignments.stockOrders.fetchAll(connectionInfo)
      .tap(function(consignments) {
        return utils.updateOauthTokens(connectionInfo);
      })
      .then(function(consignments) {
        console.log(commandName + ' > consignments.length: ', consignments.length);

        var stockOrders = _.filter(consignments,function(consignment){
          return (
                   consignment.type.toUpperCase() === 'SUPPLIER' &&
                   ((status) ? (consignment.status.toUpperCase() === status.toUpperCase()) : true)
                 );
        });
        console.log(commandName + ' > stockOrders.length: ', stockOrders.length);

        return utils.exportToJsonFileFormat(commandName, stockOrders);
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListStockOrders;
