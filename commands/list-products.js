var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');
//var Promise = require('bluebird');
var moment = require('moment');
//var _ = require('underscore');

var ListProducts = Command.extend({
  desc: 'List All Suppliers',

  options: {
    token: 'string',
    domain: 'string'
  },

  run: function (token, domain) {
    var connectionInfo = utils.loadOauthTokens(token, domain);

    var args = vendSdk.args.products.fetch();
    args.orderBy.value = 'id';
    args.page.value = 1;
    args.pageSize.value = 200;
    args.active.value = true;

    return vendSdk.products.fetch(args, connectionInfo)
      .then(function(response) {
        return utils.updateOauthTokens(connectionInfo,response);
      })
      .then(function(response) {
        console.log('response.products.length: ', response.products.length);
        //console.log('response.products: ', JSON.stringify(response.products,vendSdk.replacer,2));

        var filename = 'listProducts-' + moment.utc().format('YYYY-MMM-DD-HH:mm:ss') + '.json';
        console.log('saving to ' + filename);
        return fileSystem.write(filename, // save to current working directory
          JSON.stringify(response.products,vendSdk.replacer,2));
      })
      .catch(function(e) {
        console.error('listProducts.js - An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListProducts;
