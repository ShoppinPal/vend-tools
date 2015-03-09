var Command = require('ronin').Command;
var path = require('path');

var Version = Command.extend({
  desc: 'test',

  run: function () {
    var package = require(path.join(__dirname, '..', 'package.json'));
    console.log(package.version);
  }
});

module.exports = Version;
