var fileSystem = require('q-io/fs');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');
var nconf = require('nconf');
var path = require('path');

var updateOauthTokens = function(connectionInfo, response){
  console.log('updating oauth.json ... in case there might have been token changes');
  //console.log('connectionInfo: ' + JSON.stringify(connectionInfo,null,2));
  var oauthFile = path.join(__dirname, '..', 'oauth.json');
  console.log('oauthFile: ' + oauthFile);
  return fileSystem.write(
    oauthFile,
    JSON.stringify({
      'access_token': connectionInfo.accessToken,
      'token_type': 'Bearer',
      'refresh_token': connectionInfo.refreshToken,
      'domain_prefix': connectionInfo.domainPrefix
    },null,2))
    .then(function() {
      return Promise.resolve(response); // just passing it through to the next block
    });
};

// TODO: add a CLI spinner to indicate file is being saved? Because sometimes the pauses may appear long?
var loadOauthTokens = function(token, domain){
  // (1) Check for oauth.json and client.json via nconf
  nconf.file('client', { file: path.join(__dirname, '..', 'client.json') })
    .file('oauth', { file: path.join(__dirname, '..', 'oauth.json') });
  //console.log('nconf.get(): ', nconf.get());

  // (2) try to load client_id and client_secret and whatever else
  var connectionInfo = {
    domainPrefix: nconf.get('domain_prefix') || domain,
    accessToken: nconf.get('access_token') || token,
    // if you want auto-reties on 401, additional data is required:
    refreshToken: nconf.get('refresh_token'),
    vendTokenService: nconf.get('token_service'),
    vendClientId: nconf.get('client_id'),
    vendClientSecret: nconf.get('client_secret')
  };
  //console.log('connectionInfo: ', connectionInfo);

  // (3) if not successful then ask for it as CLI arguments
  if (!connectionInfo.accessToken) {
    throw new Error('--token should be set');
  }
  if (!connectionInfo.domainPrefix) {
    throw new Error('--domain should be set');
  }

  return connectionInfo;
};

/*var exportProductsToDbfFormat = function(products){
  var dbfkit = require('dbfkit-fork');
  var DBFWriter = dbfkit.DBFWriter;

  var header = [];
  _.each(products,function(product){
    var productKeys = _.keys(product);
    _.each(productKeys,function(productKey){

    })
  });
  var header = [
    {
      name: 'id'
    }
    'handle','sku','composite_handle','composite_sku','composite_quantity','name','description','type','variant_option_one_name','variant_option_one_value','variant_option_two_name','variant_option_two_value','variant_option_three_name','variant_option_three_value','tags','supply_price','retail_price',
    {
      name: 'name',
      type: 'C'
    }, {
      name: 'gender',
      type: 'L'
    }, {
      name: 'birthday',
      type: 'D'
    }, {
      name: 'stature',
      type: 'N',
      precision: '2'
    }, {
      name: 'registDate',
      type: 'C'
    }
  ];

  var doc = [
    {
      name: 'charmi',
      gender: true,
      birthday: new Date(),
      stature: 0,
      registDate: new Date()
    }, {
      name: 'asasas',
      gender: false,
      birthday: new Date(1935, 1, 2),
      stature: 1.87,
      registDate: new Date()
    }
  ];

  var pathName = './dbfout';
  var fileName = 'people.dbf';
  var dbfWriter = new DBFWriter(header, doc, fileName, pathName, {
    encoding: 'gb2312',
    coverIfFileExist: true
  });
  dbfWriter.write();
  console.log('finish');
};*/

var exportProductsToDbfFileFormat = function(products){
  var dbf = require('dbf');
  var neoProducts = [];
  _.each(products,function(product){
    var neoProduct = _.pick(product,'id','handle','sku','composite_handle','composite_sku','composite_quantity','name','type','variant_option_one_name','variant_option_one_value','variant_option_two_name','variant_option_two_value','variant_option_three_name','variant_option_three_value','tags','supply_price','retail_price');
    neoProducts.push(neoProduct);
  });
  var buf = dbf.structure(neoProducts);

  //fs.writeFileSync('foo.dbf', toBuffer(buf.buffer));
  var filename = 'listProducts-' + moment.utc().format('YYYY-MMM-DD-HH:mm:ss') + '.dbf';
  console.log('saving to ' + filename);
  return fileSystem.write(filename, // save to current working directory
    toBuffer(buf.buffer));
};

var toBuffer = function (ab) {
  var buffer = new Buffer(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
    buffer[i] = view[i];
  }
  return buffer;
};

var exportProductsToJsonFileFormat = function(products){
  var filename = 'listProducts-' + moment.utc().format('YYYY-MMM-DD-HH:mm:ss') + '.json';
  console.log('saving to ' + filename);
  return fileSystem.write(filename, // save to current working directory
    JSON.stringify(products,vendSdk.replacer,2));
};

var exportProductsToCsvFileFormat = function(products, outlets){
  var csv = require('fast-csv');
  var fs = require('fs');

  // NOTE: could also use _.filter() to get keys whose immediate value isn't an object or array
  var headers = ['id','handle','sku',
    'composite_handle','composite_sku','composite_quantity',
    'name'/*,'description'*/,'type',
    'variant_option_one_name','variant_option_one_value',
    'variant_option_two_name','variant_option_two_value',
    'variant_option_three_name','variant_option_three_value',
    'tags','supply_price','retail_price',
    'account_code','account_code_purchase','brand_name',
    'supplier_name','supplier_code','active','track_inventory'];
  _.each(outlets, function(outlet){
    headers.push('inventory_'+outlet.name.replace(/ /g, '_'));
    headers.push('reorder_point_'+outlet.name.replace(/ /g, '_'));
    headers.push('restock_level_'+outlet.name.replace(/ /g, '_'));
    headers.push('outlet_tax_'+outlet.name.replace(/ /g, '_'));
  });

  var csvStream = csv
    .createWriteStream({headers: headers})
    .transform(function(product){
      var neoProduct = _.pick(product,'id','handle','sku',
        'composite_handle','composite_sku','composite_quantity',
        'name'/*,'description'*/,'type',
        'variant_option_one_name','variant_option_one_value',
        'variant_option_two_name','variant_option_two_value',
        'variant_option_three_name','variant_option_three_value',
        'tags','supply_price','retail_price',
        'account_code','account_code_purchase','brand_name',
        'supplier_name','supplier_code','active','track_inventory');
      if(product.inventory){
        _.each(product.inventory, function(inventory){
          if(inventory.count !== undefined  && inventory.count !== null) {
            neoProduct['inventory_' + inventory.outlet_name.replace(/ /g, '_')] = inventory.count;
          }
          if(inventory.reorder_point !== undefined  && inventory.reorder_point !== null) {
            neoProduct['reorder_point_' + inventory.outlet_name.replace(/ /g, '_')] = inventory.reorder_point;
          }
          if(inventory.restock_level !== undefined  && inventory.restock_level !== null) {
            neoProduct['restock_level_' + inventory.outlet_name.replace(/ /g, '_')] = inventory.restock_level;
          }
        });
      }
      /*if(product.taxes) {
       // TODO: need additional API lookups to resolve values for outlet_tax_<storeName>
      }*/
      return neoProduct;
    });

  var filename = 'listProducts-' + moment.utc().format('YYYY-MMM-DD-HH:mm:ss') + '.csv';
  console.log('saving to ' + filename);
  var writableStream = fs.createWriteStream(filename);
  writableStream.on('finish', function(){
    console.log('DONE!');
  });

  csvStream.pipe(writableStream); // connect the streams

  _.each(products,function(product){
    csvStream.write(product);
  });
  csvStream.end();

  // TODO: return a Promise
};

exports.updateOauthTokens = updateOauthTokens;
exports.loadOauthTokens = loadOauthTokens;
exports.exportProductsToDbfFileFormat = exportProductsToDbfFileFormat;
exports.exportProductsToJsonFileFormat = exportProductsToJsonFileFormat;
exports.exportProductsToCsvFileFormat = exportProductsToCsvFileFormat;