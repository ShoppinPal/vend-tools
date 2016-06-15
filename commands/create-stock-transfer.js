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

var outletsByName = [];
var brandNames = [];
var outlets=[];

var source_outlet = "";
var destination_outlet = "";
var brand = "";

var commandName = path.basename(__filename, '.js'); // gives the filename without the .js extension
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

var CreateStockTransfer = Command.extend({
    desc : 'Stock Transfer',
    options:{},
    run:function(){


        var datasourcesFile = path.join(__dirname, '../client', 'datasources.json');
        console.log(commandName, 'datasourcesFile: ' + datasourcesFile);
        fs.writeFileSync(datasourcesFile,
            JSON.stringify({
                "db": {
                    "name": "db",
                    "connector": "memory"
                },
                "remoteDS": {
                    "url": params.loopbackServerUrl + "/api",
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
            .then(function getOutlets() {
                var connectionInfo = utils.loadOauthTokens();
                return vendSdk.outlets.fetch({}, connectionInfo)
                    .then(function (response) {
                        //console.log(response);
                        response.outlets.forEach(function (singleOutlet) {
                            outlets.push({id:singleOutlet.id,name:singleOutlet.name})
                            outletsByName.push(singleOutlet.name);
                        });
                        //console.log("ID:",outletsById);
                        //console.log("Name:",outletsByName);
                        return getSourceOutletChoice()
                            .then(function () {
                                console.log(source_outlet);
                                return getDestinationOutletChoice()
                                    .then(function(){
                                        console.log(destination_outlet);
                                    })
                            })

                    });

            })
            .then(function getBrands() {

                var connectionInfo = utils.loadOauthTokens();
                return vendSdk.products.fetchAll(connectionInfo)
                    .then(function (products) {
                        console.log(products.length);

                        products.forEach(function (singleProduct) {
                            if (singleProduct.brand_name != "") {
                                if (!(brandNameExists(singleProduct.brand_name, brandNames))) {
                                    brandNames.push(singleProduct.brand_name);
                                }
                            }

                        });

                        return getBrandChoice()
                            .then(function () {
                                console.log(brand);
                                return Promise.resolve(products);
                            });
                    });

            })
            .tap(function stockTransfer(products){


                        var argsForBrandFetch = {where:{brand_name:brand}};
                        var filteredProducts = loopback_filter(products,argsForBrandFetch);
                        //console.log(filteredProducts.length);
                        var destination_outlet_id = outlets[getIndexOfOutletId(destination_outlet,outlets)].id;
                        var source_outlet_id = outlets[getIndexOfOutletId(source_outlet,outlets)].id;
                        //console.log(destination_outlet_id);
                        //console.log(source_outlet_id);
                        var toBeTransferred = [];
                        filteredProducts.forEach(function(singleProduct){
                            if(singleProduct.inventory != undefined){
                               var singleProductInventory = singleProduct.inventory;
                               singleProductInventory.forEach(function(inv){

                                   if(inv.outlet_id == destination_outlet_id)
                                   {


                                        if(parseInt(inv.count)<=inv.reorder_point && inv.count>0){
                                            console.log(singleProduct.name, 'needs to be ordered in quantity of : ',inv.reorder_point-inv.count);

                                            toBeTransferred.push({'product_id':singleProduct.id,'name':singleProduct.name,'count' : inv.reorder_point-inv.count,'cost':1000});
                                        }
                                   }
                               });
                            }
                        });

                        //console.log(toBeTransferred);
                        filteredProducts.forEach(function(singleProduct){
                            if(singleProduct.inventory != undefined){
                                var singleProductInventory = singleProduct.inventory;
                                singleProductInventory.forEach(function(inv) {

                                    if(inv.outlet_id == source_outlet_id)
                                    {
                                        var index = productIdExists(singleProduct.id,toBeTransferred);

                                        if(index!=-1)
                                        {
                                            if(toBeTransferred[index].count <= inv.count)
                                            {
                                                console.log(singleProduct.name);
                                            }

                                        }
                                    }


                                })
                            }
                        });


                var connectionInfo = utils.loadOauthTokens();

                                var argsForCreateConsignment = {
                    name:{value:"TestWithAll2"},
                    dueAt:{value:"2016-06-17"},
                    outletId:{value:destination_outlet_id},
                    sourceId:{value:source_outlet_id},
                    products:{value:toBeTransferred}
                };

                var consignment = vendSdk.consignments.stockOrders.stockTransfer(argsForCreateConsignment,connectionInfo)

                    .then(function (consignments) {
                        console.log(consignments);
                    })


            })

            .catch(function (error) {
                console.error('2nd last dot-catch block');
                console.log(commandName, 'ERROR', error.stack);
                return Promise.reject(error);
            });

    }

});


function productIdExists(productId, array) {
    var i = null;
    for (i = 0; array.length > i; i += 1) {
        if (array[i].product_id === productId) {
            return i;
        }
    }

    return -1;
};

function brandNameExists(brandName, array) {
    var i = null;
    for (i = 0; array.length > i; i += 1) {
        if (array[i] == brandName) {
            return true;
        }
    }

    return false;
};


var getSourceOutletChoice = function(){

    return asking.chooseAsync('Choose source outlet : ',outletsByName)
        .tap(function(resolvedResults){
            source_outlet = resolvedResults[0];
            var index = outletsByName.indexOf(resolvedResults[0]);
            outletsByName.splice(index,1);
        })
        .catch(function (error) {
            console.log('Incorrect selection! Please choose correct option');
            return getSourceOutletChoice();
        });

};

var getDestinationOutletChoice = function(){
    return asking.chooseAsync('Choose destination outlet : ',outletsByName)
        .tap(function(resolvedResults){
            destination_outlet = resolvedResults[0];
        })
        .catch(function (error) {
            console.log('Incorrect selection! Please choose correct option');
            return getDestinationOutletChoice();
        });
}

function getIndexOfOutletId(outletName,outlets){
    var i = null;
    for (i = 0; outlets.length > i; i += 1) {
        if (outlets[i].name == outletName) {
            return i;
        }
    }
    return -1;
}

var getBrandChoice = function(){

    return asking.chooseAsync('Choose brand : ',brandNames)
        .tap(function(resolvedResults){
            brand = resolvedResults[0];
        })
        .catch(function (error) {
            console.log('Incorrect selection! Please choose proper option');
            return getBrandChoice();
        });

};

module.exports = CreateStockTransfer;