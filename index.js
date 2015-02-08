var ronin = require('ronin');

var program = ronin({
  path: __dirname,
  desc: 'This command-line-interface (CLI) allows you to easily perform custom tasks for your vendhq.com instance.'
});

program.run();
