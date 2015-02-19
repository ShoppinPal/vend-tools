var ronin = require('ronin');

var program = ronin({
  path: __dirname,
  desc: 'This command-line-interface (CLI) allows you to easily perform custom tasks for your vendhq.com instance.',
  options: {
    token: {
      type: 'string',
      aliases: ['t']
    },
    domain: {
      type: 'string',
      aliases: ['d']
    },
    output: {
      type: 'string',
      aliases: ['o']
    }
  }
});

program.run();
