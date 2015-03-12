var Command = require('ronin').Command;

var Promise = require('bluebird');
var asking = Promise.promisifyAll(require('asking'));
//var choose = require('asking').choose;
//var ask = require('asking').ask;

var vendSdk = require('vend-nodejs-sdk')({});
var utils = require('./../utils/utils.js');
var fileSystem = require('q-io/fs');

var moment = require('moment');
var _ = require('underscore');
var path = require('path');
var open = require('open');

// Global variable for logging
var commandName = path.basename(__filename, '.js'); // gives the filename without the .js extension

// Global variables for interval
var aWeekAgo = moment.utc().subtract(1, 'weeks');
var twoWeeksAgo = moment.utc().subtract(2, 'weeks');
var aMonthAgo = moment.utc().subtract(4, 'weeks');
var sixWeeksAgo = moment.utc().subtract(6, 'weeks');
var twoMonthsAgo = moment.utc().subtract(8, 'weeks');
var intervalOptions = [
  aWeekAgo,
  twoWeeksAgo,
  aMonthAgo,
  sixWeeksAgo,
  twoMonthsAgo
];
var intervalOptionsForDisplay = [
    'Starting a week ago (' + aWeekAgo.format('YYYY-MM-DD') + ')',
    'Starting two weeks ago (' + twoWeeksAgo.format('YYYY-MM-DD') + ')',
    'Starting a month ago (' + aMonthAgo.format('YYYY-MM-DD') + ')',
    'Starting six weeks ago (' + sixWeeksAgo.format('YYYY-MM-DD') + ')',
    'Starting two months ago (' + twoMonthsAgo.format('YYYY-MM-DD') + ')',
    'other'
];

// the command's implementation
var ExportAllSales = Command.extend({
  desc: 'Export all Sales (JSON format by default)',

  options: { // must not clash with global aliases: -t -d -f
    outletId: {
      type: 'string',
      aliases: ['o'] // TODO: once Ronin is fixed to accept 2 characters as an alias, use 'oi' alias
    },
    interval: {
      type: 'string',
      aliases: ['i']
    },
    beginFrom: { // alternative to interval specified as a date in YYYY-MM-DD format
      type: 'string',
      aliases: ['b']
    }
  },

  run: function (outletId, interval, beginFrom) {
    var token = this.global.token;
    var domain = this.global.domain;

    var connectionInfo = utils.loadOauthTokens(token, domain);
    commandName = commandName;// + '-'+ connectionInfo.domainPrefix;

    return validateOutlet(outletId, connectionInfo)
      .tap(function(resolvedOutletId) {
        //console.log(commandName + ' > 1st tap block');
        return utils.updateOauthTokens(connectionInfo);
      })
      .then(function(resolvedOutletId){
        outletId = resolvedOutletId;
        if (beginFrom) {
          return validateBeginFrom(beginFrom);
        }
        else {
          return validateInterval(interval);
        }
      })
      .then(function(since){
        var iORb = (interval) ? (' -i ' + interval) : (' -b ' + since.format('YYYY-MM-DD'));
        console.log('vend-tools ' + commandName +
          ' -o ' + outletId +
            iORb
        );
        runMe(connectionInfo, outletId, since);
      });
  }
});

var validateBeginFrom = function(beginFrom) {
  if (beginFrom) {
    var since = moment.utc(beginFrom, 'YYYY-MM-DD');
    console.log('validateBeginFrom > since: ' + since);
    console.log('startAnalyzingSalesHistorySince: ' + since.format('YYYY-MM-DD'));
    return Promise.resolve(since);
  }
  else {
    return Promise.reject('--beginFrom or -b should be a date in YYYY-MM-DD format');
  }
};

var validateInterval = function(interval) {
  if (interval) {
    var since = null;
    switch(interval) {
      case '1w':
        since = intervalOptions[0];
        break;
      case '2w':
        since = intervalOptions[1];
        break;
      case '1m':
        since = intervalOptions[2];
        break;
      case '6w':
        since = intervalOptions[3];
        break;
      case '2m':
        since = intervalOptions[4];
        break;
      default:
        throw new Error('--interval should be set as 1w or 2w or 1m or 2m');
    }
    console.log('startAnalyzingSalesHistorySince: ' + since.format('YYYY-MM-DD'));
    return Promise.resolve(since);
  }
  else {
    return chooseInterval();
  }
};

var chooseInterval = function(){
  return asking.chooseAsync('How far back from today should the sales history be analyzed?', intervalOptionsForDisplay)
    .then(function (resolvedResults/*err, startAnalyzingSalesHistorySince, indexOfSelectedValue*/) {
      var startAnalyzingSalesHistorySince = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      if (startAnalyzingSalesHistorySince.toUpperCase() === 'other'.toUpperCase()) {
        return asking.askAsync('Please provide a starting date in YYYY-MM-DD format: ')
          .then(function (resolvedResults) {
            var beginAt = resolvedResults;
            if (beginAt.length!=10){
              return Promise.reject('Invalid input...');
            }
            beginAt = moment.utc(beginAt, 'YYYY-MM-DD');
            console.log('You selected: ' + beginAt.format('YYYY-MM-DD'));
            return Promise.resolve(beginAt);
          })
          .catch(function(e) {
            console.error(commandName + ' > An unexpected error occurred: ', e);
            console.log('Try again...');
            return chooseInterval();
          });
      }
      else {
      var since = intervalOptions[indexOfSelectedValue];
      console.log('startAnalyzingSalesHistorySince: ' + since.format('YYYY-MM-DD'));
      return Promise.resolve(since);
      }
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose an option between 1 - ' + intervalOptions.length);
      return chooseInterval();
    });
};

var validateOutlet = function(outletId, connectionInfo) {
  if (outletId) {
    return Promise.resolve(outletId);
  }
  else {
    // if the outletId isn't specified, prompt the user with a list of user friendly outlet names to choose from
    return fetchOutlets(connectionInfo)
      .then(function(outlets){
        return chooseOutlet(outlets)
          .then(function(selectedValue){
            return Promise.resolve(selectedValue);
          });
      });
  }
};

var fetchOutlets = function(connectionInfo){
  return vendSdk.outlets.fetch({}, connectionInfo)
    .then(function(outletsResponse) {
      //console.log('outletsResponse: ', outletsResponse);
      console.log('outletsResponse.outlets.length: ', outletsResponse.outlets.length);
      //console.log('outletOptions: ' + _.pluck(outletsResponse.outlets,'id'));
      //console.log('outletOptions: ' + _.pluck(outletsResponse.outlets,'name'));
      console.log('====done with outlets fetch====');
      return Promise.resolve(outletsResponse.outlets);
    });
};

var chooseOutlet = function(outlets){
  var outletOptionsForDisplay = _.pluck(outlets,'name');
  var outletOptions = _.pluck(outlets,'id');

  return asking.chooseAsync('Which outlet?', outletOptionsForDisplay)
    .then(function (resolvedResults) {
      var userFriendlySelectedValue = resolvedResults[0];
      var indexOfSelectedValue = resolvedResults[1];
      var systemOrientedSelectedValue = outletOptions[indexOfSelectedValue];
      console.log('selectedValue: ' + systemOrientedSelectedValue);
      return Promise.resolve(systemOrientedSelectedValue);
    })
    .catch(function(e) {
      //console.error(commandName + ' > An unexpected error occurred: ', e);
      console.log('Incorrect selection! Please choose an option between 1 - ' + outletOptions.length);
      return chooseOutlet(outlets);
    });
};

var runMe = function(connectionInfo, outletId, since){
  var sinceAsString = since.format('YYYY-MM-DD');
  /*console.log('since.format(): ' + since.format()); // by default moment formats it as ISO 8601 which is what Vend wants
   console.log('since.format(\'YYYY-MM-DD HH:MM:SS\'): ' + since.format('YYYY-MM-DD HH:MM:SS'));*/

  var argsForSales = vendSdk.args.sales.fetch();
  argsForSales.since.value = sinceAsString;
  argsForSales.outletApiId.value = outletId;
  return vendSdk.sales.fetchAll(argsForSales, connectionInfo)
    .tap(function(sales) {
      console.log(commandName + ' > 1st then block');
      return utils.updateOauthTokens(connectionInfo);
    })
    .then(function(sales) {
      console.log('original sales.length: ' + sales.length);

      return utils.exportToJsonFileFormat(commandName+'-salesOrig', sales)
        .then(function() {
          sales = _.filter(sales, function(sale){
            return moment.utc(sale.sale_date).isAfter(since);
          });
          console.log('filtered sales.length: ' + sales.length);
          return utils.exportToJsonFileFormat(commandName+'-salesSince', sales)
        })
    })
    .catch(function(e) {
      console.error(commandName + ' > An unexpected error occurred: ', e);
    });
};

module.exports = ExportAllSales;
