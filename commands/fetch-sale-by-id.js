var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var Promise = require('bluebird');
var _ = require('underscore');
var path = require('path');


var FetchSaleById = Command.extend({
  desc: 'Fetches a sale by id',
  
  options: {
    id: 'string'
  },
  
  run: function (id) {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token;
    var domain = this.global.domain;
    if (!id) {
      throw new Error('--id should be set');
    }
    var connectionInfo = utils.loadOauthTokens(token, domain);
    
    // fetch a product by ID
    var args = vendSdk.args.sales.fetchById();
    args.apiId.value = id;
    return vendSdk.sales.fetchById(args, connectionInfo)
      .tap(function (response) {
        console.log(commandName + ' > 1st then block');
        return utils.updateOauthTokens(connectionInfo);
      })
      .then(function (response) {
        console.log(commandName + ' > 2nd then block');
        //console.log(commandName + ' > response.products[0]: ' + JSON.stringify(response.products[0],vendSdk.replacer,2));
        
        if (response.data) {
          console.log(commandName + ' > 1 matching results were found.');
          return utils.exportToJsonFileFormat(commandName, response.data);
        }
        else {
          console.log(commandName + ' > No matching result(s) were found.');
          return Promise.resolve();
        }
      })
      .catch(function (e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = FetchSaleById;
