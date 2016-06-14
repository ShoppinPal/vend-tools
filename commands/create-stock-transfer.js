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

var outletsById = [];
var outletsByName = [];

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
                            outletsById.push(singleOutlet.id);
                            outletsByName.push(singleOutlet.name);
                        });
                        //console.log("ID:",outletsById);
                        //console.log("Name:",outletsByName);
                        return getOutletChoice()
                            .then(function () {
                                console.log(source_outlet, destination_outlet);
                            })
                    });

            })
            .then(function getBrands(){

                var connectionInfo = utils.loadOauthTokens();
                return vendSdk.products.fetchAll(connectionInfo)
                    .then(function(products){
                        console.log(products.length);
                        var brandNames = [];
                        products.forEach(function(singleProduct){
                           if(brandNameExists(singleProduct.brand_name,brandNames))
                           {
                                brandNames.push(singleProduct.brand_name);
                           }

                        });
                        console.log(brandNames);
                    });
/*
                        var argsForBrandFetch = {where:{brand_name:"T-WE TEA"}};
                        //var undefinedFilter = {where:{inventory:undefined}};
                        var filteredProducts = loopback_filter(response,argsForBrandFetch);

                        //var filteredProducts = loopback_filter(response.products,undefinedFilter);
                        var outlet_id = "b8ca3a6e-72a7-11e4-efc6-42e8c7021d82";//NYC
                        var source_outlet_id = "aea67e1a-b85c-11e2-a415-bc764e10976c";//ShoppinPal OKC
                        var toBeTransferred = [];
                        filteredProducts.forEach(function(singleProduct){
                            if(singleProduct.inventory != undefined){
                               var singleProductInventory = singleProduct.inventory;
                               singleProductInventory.forEach(function(inv){

                                   if(inv.outlet_id == outlet_id)
                                   {


                                        if(parseInt(inv.count)<=inv.reorder_point && inv.count>0){
                                            console.log(singleProduct.name, 'needs to be ordered in quantity of : ',inv.restock_level-inv.count);

                                            toBeTransferred.push({'id':singleProduct.id,'toBeOrdered' : inv.restock_level-inv.count});
                                        }
                                   }
                               });
                            }
                        });

                        console.log(toBeTransferred);
                        filteredProducts.forEach(function(singleProduct){
                            if(singleProduct.inventory != undefined){
                                var singleProductInventory = singleProduct.inventory;
                                singleProductInventory.forEach(function(inv) {

                                    if(inv.outlet_id == source_outlet_id)
                                    {
                                        var index = productIdExists(singleProduct.id,toBeTransferred);

                                        if(index!=-1)
                                        {
                                            if(toBeTransferred[index].toBeOrdered <= inv.count)
                                            {
                                                console.log(singleProduct.name);
                                            }

                                        }
                                    }


                                })
                            }
                        })



                    });*/

                /*                var argsForCreateConsignment = {
                    name:{value:"TestTrans2"},
                    dueAt:{value:"2016-06-15"},
                    outletId:{value:"aea67e1a-b85c-11e2-a415-bc764e10976c"},
                    sourceId:{value:"b8ca3a6e-72a7-11e4-efc6-42e8c7021d82"},
                    products:{value:[
                        {
                            "id": "b743d528-6b63-102e-bfb4-6e9396395811",
                            "product_id": "c4fd01fc-c634-11e3-a0f5-b8ca3a64f8f4",
                            "name": "CUP - Ville de Plouc",
                            "count": 10,
                            "received": 10,
                            "cost": "1.00",
                            "created_at": "2016-06-14 04:06:42",
                            "updated_at": "2016-06-14 04:06:42"
                        },
                        {
                            "id": "b744d9a0-6b63-102e-bfb4-6e9396395811",
                            "product_id": "c534e683-c634-11e3-a0f5-b8ca3a64f8f4",
                            "name": "CUP - You",
                            "count": 10,
                            "received": 10,
                            "cost": "400.00",
                            "created_at": "2016-06-14 04:06:42",
                            "updated_at": "2016-06-14 04:06:42"
                        }
                    ]}
                };

                var consignment = vendSdk.consignments.stockOrders.stockTransfer(argsForCreateConsignment,connectionInfo)

                    .then(function (consignments) {
                        console.log(consignments);
                    })
*/
                /*var outlet = vendSdk.outlets.fetch({},connectionInfo)
                    .then(function(response)
                    {
                        console.log(response);
                        response.outlets.forEach(function(singleOutlet){
                            outletsById.push(singleOutlet.id);
                            outletsByName.push(singleOutlet.name);
                        });
                        console.log("ID:",outletsById);
                        console.log("Name:",outletsByName);




                        return Promise.resolve();
                    });
*/



            })
/*            .then(function getConsignments() {
                //get consignments to find products on the consignment for maximum 2 weeks
                console.log("ID:",outletsById);
                console.log("Name:",outletsByName);
                console.log("Source : ",source_outlet);
*/
/*
                return asking.chooseAsync('Choose source outlet', outletsByName)
                    .then(function (resolvedResults/*err, selectedValue, indexOfSelectedValue) {
                        var selectedValue = resolvedResults[0];
                        var indexOfSelectedValue = resolvedResults[1];
                        console.log(selectedValue, indexOfSelectedValue);
                    })*/
                        /*if (selectedValue === 'Yes') {
                            var connectionInfo = utils.loadOauthTokens();

                            var connectionInfo = utils.loadOauthTokens();
                            console.log(connectionInfo);
                        }
                    })
                    .catch(function(e) {
                        //console.error(commandName + ' > An unexpected error occurred: ', e);
                        console.log('Incorrect selection! Please choose 1 or 2');
                        return getChoiceForConfirmingDeletion();
                    });
                var argsForCreateConsignment = {
                    name:{value:"TestTransfer"},
                    dueAt:{value:"2016-06-15"},
                    outletId:{value:"aea67e1a-b85c-11e2-a415-bc764e10976c"},
                    sourceId:{value:"b8ca3a6e-72a7-11e4-efc6-42e8c7021d82"}
                };

                var consignments = vendSdk.consignments.stockOrders.stockTransfer(argsForCreateConsignment,connectionInfo)

                    .then(function (consignments) {
                      //console.log(consignments);

                        //var dateFilter = {where: {consignment_date: {gt: '2016-01-01'}}};
                        //var filteredConsignments = loopback_filter(consignments,dateFilter);
                        console.log(consignments);
                    })


*/
            //})
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
        if (array[i].id === productId) {
            return i;
        }
    }

    return -1;
};

function brandNameExists(brandName, array) {
    var i = null;
    for (i = 0; array.length > i; i += 1) {
        if (array[i] === brandName) {
            return true;
        }
    }

    return false;
};


var getOutletChoice = function(){
    console.log('in getOutletChoice');
    return asking.chooseAsync('Choose source outlet : ',outletsByName)
        .tap(function(resolvedResults){
            source_outlet = resolvedResults[0];
            var index = outletsByName.indexOf(resolvedResults[0]);
            outletsByName.splice(index,1);
        })
        .then(function(){
            return asking.chooseAsync('Choose destination outlet : ',outletsByName);
        })
        .tap(function(resolvedResults){
            destination_outlet = resolvedResults[0];
        })
        .catch(function (error) {
            console.log('Incorrect selection! Please choose 1 or 2');
            return getOutletChoice();
        });

}

module.exports = CreateStockTransfer;