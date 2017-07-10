var Command = require('ronin').Command;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
//var Promise = require('bluebird');
var _ = require('underscore');
var path = require('path');

var ListCustomers = Command.extend({
  desc: 'List All Cutomers',

  options: { // must not clash with global aliases: -t -d -f
    id: 'string',
    code: 'string',
    email: 'string',
    since: 'string',
   // page: 'string',
   // pageSize: 'string'
  },

  run: function (id, code, email, since, page, pageSize) {
    var commandName = path.basename(__filename, '.js');
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);
    var args = vendSdk.args.customers.fetch();
    
    if (id && (code || email)) 
      throw new Error('--id can not be used with code or email.');
    else if(code && (id || email))
      throw new Error('--code can not be used with id or email.');
    else if(email && (id || code))
      throw new Error('--email can not be used with code or id.');

    // if(page)
    //   args.page = page;
    // if(pageSize)
    //   args.pageSize = pageSize;

    args.apiId.value = id;
    args.code.value = code;
    args.email.value = email;
    args.since.value = since;

    return vendSdk.customers.fetch(args, connectionInfo)
      .tap(function(customerResponse) {
        return utils.updateOauthTokens(connectionInfo, domain);
      })
      .then(function(customerResponse) {
        console.log(commandName + ' > customerResponse.customers.length: ', customerResponse.customers.length);
        return utils.exportToJsonFileFormat(commandName, customerResponse.customers);
      })
      .catch(function(e) {
        console.error(commandName + ' > An unexpected error occurred: ', e);
      });
  }
});

module.exports = ListCustomers;
