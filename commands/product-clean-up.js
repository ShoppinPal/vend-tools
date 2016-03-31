var Command = require('ronin').Command;
var moment = require('moment');
var fs = require('fs');
var utils = require('./../utils/utils.js');
var path = require('path');
var Promise = require('bluebird');
var _ = require('underscore');
var vendSdk = require('vend-nodejs-sdk')({});
var loopback_filter = require('loopback-filters');
var asking = Promise.promisifyAll(require('asking'));


var params = null;
var client = null;
var remotes = null;

var commandName = path.basename(__filename, '.js'); // gives the filename without the .js extension
var consignmentProductsById = [];
var outletsById = [];
var filteredSales = [];
var deleteFromVend = [];

//console.log(commandName, process.argv);
var settings = require('../settings.json');
var defaultOutputDirectory = settings.defaultOutputDirectory;

try{
    var nconf = require('nconf');
    nconf.file('client', {file: path.join(__dirname, '..', 'client'+'.json')})
        .file('oauth', {file: path.join(__dirname, '..', 'oauth'+'.json')})
        .file('settings',{file: path.join(__dirname, '..', 'settings'+'.json')});

    //console.log(commandName, 'nconf:', nconf.get());
    params = nconf.get();

}
catch(e){
    console.log("nconf error : "+e.stack);
}

var threeMonthsAgo = moment.utc().subtract(3, 'months').format('YYYY-MM-DD');
var sixMonthsAgo = moment.utc().subtract(6, 'months').format('YYYY-MM-DD');
var aYearAgo = moment.utc().subtract(1, 'years').format('YYYY-MM-DD');

var intervalOptions = [
    threeMonthsAgo,
    sixMonthsAgo,
    aYearAgo
];

var ProductCleanUp = Command.extend({
    desc: 'Product clean up',
    options : {
        checkSalesSinceDate: {
            type: 'string',
            aliases: ['r']
        },
        interval: {
            type: 'string',
            aliases: ['i']
        }
    },
    run: function (checkSalesSinceDate,interval) {
        var sinceDate = null;
        if (checkSalesSinceDate) {
            sinceDate = validateCheckSalesSinceDate(checkSalesSinceDate);
        }
        else if (interval) {
            sinceDate = validateInterval(interval);
        }
        else {
            throw new Error('--checkSalesSinceDate or -r should be set OR --interval or -i should be set');
        }

        params.checkSalesSinceDate = sinceDate;
        console.log(params);

        var datasourcesFile = path.join(__dirname, '../client', 'datasources.json');
        console.log(commandName, 'datasourcesFile: ' + datasourcesFile);
        fs.writeFileSync(datasourcesFile,
            JSON.stringify({
                "db": {
                    "name": "db",
                    "connector": "memory"
                },
                "remoteDS": {
                    "url":params.loopbackServerUrl+"/api",
                    "name": "remoteDS",
                    "connector": "remote"
                }
            }, null, 2));
        var datasourcesContent = require(datasourcesFile);
        console.log(commandName, 'datasourcesContent: ' + JSON.stringify(datasourcesContent, null, 2));
        // HACK ends

        client = require('../client/loopback.js');
        // the remote datasource
        var remoteDS = client.dataSources.remoteDS;

        // the strong-remoting RemoteObjects instance
        remotes = remoteDS.connector.remotes;
        return Promise.resolve(params)
            .then(function (params) { // (1) create a report if params.reportId is empty


                return client.models.UserModel.loginAsync(params.credentials) // get an access token
                    .then(function (token) {
                        console.log('Logged in as', params.credentials.email);

                        params.loopbackAccessToken = token;

                        // set the access token to be used for all future invocations
                        console.log(commandName, 'params.loopbackAccessToken.id', params.loopbackAccessToken.id);
                        console.log(commandName, 'params.loopbackAccessToken.userId', params.loopbackAccessToken.userId);
                        remotes.auth = {
                            bearer: (new Buffer(params.loopbackAccessToken.id)).toString('base64'),
                            sendImmediately: true
                        };
                        console.log(commandName, 'the access token to be used for all future invocations has been set');

                        return Promise.resolve();
                    })
            })
            .then(function getConsignments() {
                //get consignments to find products on the consignment for maximum 2 weeks


                var connectionInfo = utils.loadOauthTokens();
                var consignments = vendSdk.consignments.stockOrders.fetchAll(connectionInfo)

                    .then(function (consignments) {
                        var consignmentsById = [];

                        var now = moment().format('YYYY-MM-DD');
                        var indexFortoday = moment().day();
                        var getMeToThisSunday = moment().day("Sunday").format('YYYY-MM-DD');
                        var getMeToLastSunday_NoMatterWhatTheCurrentDayOfTheWeekIs = moment().day(-7).format('YYYY-MM-DD');
                        var dateFilter = {where: {consignment_date: {gt: getMeToLastSunday_NoMatterWhatTheCurrentDayOfTheWeekIs}}};

                        var sentOrOpenFilter = {where: {status: 'OPEN'}};// {inq: ['OPEN', 'SENT']}}};
                        var cleanedConsignments = loopback_filter(consignments, sentOrOpenFilter);
                        var filteredDateConsignments = loopback_filter(cleanedConsignments, dateFilter);

                        filteredDateConsignments.forEach(function (consignment) {
                            //console.log(consignment.status);
                            consignmentsById.push(consignment.id);

                        })
                        console.log(commandName, 'consignmentsById.length : ', consignmentsById.length);
                        var argsForConsignments = {
                            page: {required: false, key: 'page', value: undefined},
                            pageSize: {required: false, key: 'page_size', value: undefined},
                            consignmentIdIndex: {required: false, key: 'consignment_index', value: undefined},
                            consignmentIds: {required: true, key: 'consignment_id', value: consignmentsById}
                        };
                        var consignmentProducts = vendSdk.consignments.products.fetchAllForConsignments(argsForConsignments, connectionInfo)
                            .then(function getConsignmentProducts(consignmentProducts) {


                                consignmentProducts.forEach(function (singleConsignment) {
                                    if (!(consignmentIdExists(singleConsignment.product_id, consignmentProductsById))) {
                                        consignmentProductsById.push(singleConsignment.product_id);
                                    }
                                })
                                console.log(commandName, 'consignmentProductsById.length : ', consignmentProductsById.length);

                                function consignmentIdExists(productId, array) {
                                    var i = null;
                                    for (i = 0; array.length > i; i += 1) {
                                        if (array[i].product_id === productId) {
                                            return true;
                                        }
                                    }

                                    return false;
                                };

                            })


                    })
            })
            .then(function getSales() {
                //check for zero sales


                //var sinceDate = moment.utc().subtract(2, 'days').format('YYYY-MM-DD');
                var argsForSales = vendSdk.args.sales.fetch();
                sinceDate = params.checkSalesSinceDate;
                argsForSales.since.value = sinceDate;
                //argsForSales.outletApiId.value = params.outletId;
                var connectionInfo = utils.loadOauthTokens();
                //console.log(connectionInfo);
                return vendSdk.sales.fetchAll(argsForSales, connectionInfo)
                    .then(function (registerSales) {

                        return Promise.resolve(registerSales);
                    });

            })

            .tap(function filterSales(registerSales) {

                var connectionInfo = utils.loadOauthTokens();
                //console.log(connectionInfo);
                console.log(commandName, 'Register Sale : ' + registerSales.length);
                registerSales.forEach(function (singleSale) {
                    var singleProductSale = singleSale.register_sale_products;
                    singleProductSale.forEach(function (sale) {
                        filteredSales.push(sale);
                        //console.log(sale);
                    })
                })

                return Promise.resolve(filteredSales);

            })
            .then(function findProducts() {
                //get all products information

                var connectionInfo = utils.loadOauthTokens();
                return vendSdk.products.fetchAll(connectionInfo)
                    //var products = require('/home/yashg/product-data.json');
                    //return Promise.resolve(products)
                    .then(function (products) {


                        console.log(commandName, 'Filtered sale : ' + filteredSales.length);
                        var dilutedSales = [];
                        filteredSales.forEach(function (singleSale) {
                            //console.log("Filtered product name : "+ singleSale.name);
                            if ((!(salesIdExists(singleSale.product_id, dilutedSales)))) {
                                dilutedSales.push(singleSale);
                            }
                        })
                        console.log(commandName, 'Diluted sale : ' + dilutedSales.length);

                        var singleProduct = null;
                        var i = 0, j = 0;
                        var sum = parseInt(0);
                        var ffccFilter = {where : {supplier_name :{"inq": ["SAVVY COMPANY","Classic Erotica","Curve Novelties","DON JOHNSON ENTERPRISES","Cowley Distributing", "CSC","Discontinued","Greeting Cards","Miscellaneous","Pure Play Media","MPC","","FFCC Nonstock","FFCC Cable Movies","FFCC Forms & Supplie","FFCC Shoes","FFCC SPECIALTY"]}}};
                        //var ffccFilter = {where: {supplier_name: {"inq": ["Blah", "CSC", "Fermiyon", "T-WE TEA", ""]}}};
                        //var ffccFilter = {where:{inventory:undefined}};
                        var filterOutFfccAndVendProducts = loopback_filter(products, ffccFilter);

                        console.log(filterOutFfccAndVendProducts.length);
                        //console.log(cleanedProducts.length);

                        filterOutFfccAndVendProducts.forEach(function (product) {
                            sum = 0;
                            if (!(salesIdExists(product.id, dilutedSales))) {

                                var singleProductInventory = product.inventory;
                                singleProductInventory.forEach(function (inv) {

                                    sum = parseInt(sum) + parseInt(inv.count);
                                });

                                if (sum == parseInt(0)) {
                                    if (!(consignmentIdExists(product.id, consignmentProductsById))) {
                                        if (!(productsIdExists(product.id, deleteFromVend))) {
                                            deleteFromVend.push(product);
                                            //fs.appendFileSync('/home/yashg/product-clean-up.txt',product.name+"\n",'utf8');
                                            j++;
                                        }
                                    }
                                }
                            }
                        })

                        function consignmentIdExists(productId, array) {
                            var i = null;
                            for (i = 0; array.length > i; i += 1) {
                                if (array[i] === productId) {
                                    return true;
                                }
                            }

                            return false;
                        };


                        function salesIdExists(productId, array) {
                            var i = null;
                            for (i = 0; array.length > i; i += 1) {
                                if (array[i].product_id === productId) {
                                    return true;
                                }
                            }

                            return false;
                        };

                        function productsIdExists(productId, array) {
                            var i = null;
                            for (i = 0; array.length > i; i += 1) {
                                if (array[i].id === productId) {
                                    return true;
                                }
                            }

                            return false;
                        };

                        console.log(commandName, 'Deletion count : ' + deleteFromVend.length);

                        return utils.exportProductsToCsvFileFormat('export-deletion-products', deleteFromVend)
                            .then(function () {
                                console.log(commandName, "Export completed.");
                                return getChoiceForConfirmingDeletion();
                            });


                    })
            })

            .catch(function (error) {
                console.error('2nd last dot-catch block');
                console.log(commandName, 'ERROR', error.stack);
                return Promise.reject(error);
            });

    }
});

var validateCheckSalesSinceDate = function(checkSalesSinceDate) {
    var check = moment.utc(checkSalesSinceDate, 'YYYY-MM-DD',true).isValid();
    if (check) {
        return checkSalesSinceDate;
    }
    else {
        throw new Error('--checkSalesSinceDate or -r should be a date in YYYY-MM-DD format');
    }
};

var validateInterval = function(interval) {
    if (interval) {
        var since = null;
        switch(interval) {
            case '3m':
                since = intervalOptions[0];
                break;
            case '6m':
                since = intervalOptions[1];
                break;
            case '1y':
                since = intervalOptions[2];
                break;
            default:
                throw new Error('--interval should be set as 3m or 6m or 1y');
        }

        return since;
    }
    else {
        throw new Error('--interval or -i is not valid');
    }
};

var successful = 0,unsuccessful=0;


var getChoiceForConfirmingDeletion = function(){


    return asking.chooseAsync('Do you want to DELETE these products?', ['Yes', 'No'])
        .then(function (resolvedResults/*err, selectedValue, indexOfSelectedValue*/) {
            var selectedValue = resolvedResults[0];
            var indexOfSelectedValue = resolvedResults[1];
            //console.log(selectedValue, indexOfSelectedValue);
            if (selectedValue==='Yes') {
                var connectionInfo = utils.loadOauthTokens();
                return Promise.map(
                    deleteFromVend,
                    function(singleProductToDelete){
                        var argsForDeletion = {apiId:{value : singleProductToDelete.id}};

                        return vendSdk.products.delete(argsForDeletion,connectionInfo)
                            .then(function deletionResults(deleteIt){
                                if(deleteIt.status != "success"){
                                    unsuccessful++;
                                    fs.appendFileSync(defaultOutputDirectory+"nonDeletable.txt",unsuccessful+". Product : "+ singleProductToDelete.name +" Reason : "+ deleteIt.details+"\n",'utf8');
                                }
                                else {
                                    successful++;
                                }

                            })
                            .catch(function(e){
                                console.log(e.stack);
                            })

                    },
                    {concurrency:1}
                )
                .then(function(){
                    console.log(commandName,"Successful deletions : "+ successful + " Unsuccessful deletions : "+ unsuccessful);
                    return Promise.resolve();
                });

            }
            else {
                //settings.defaultOutputDirectory = nconf.get('defaultOutputDirectory') || '';
                console.log("Aborting deletion process.");
                return Promise.resolve();
            }
        })
        .catch(function(e) {
            //console.error(commandName + ' > An unexpected error occurred: ', e);
            console.log('Incorrect selection! Please choose 1 or 2');
            return getChoiceForConfirmingDeletion();
        });

};

module.exports = ProductCleanUp;
