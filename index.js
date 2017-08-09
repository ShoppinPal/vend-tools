var ronin = require('ronin');

var program = ronin({
  path: __dirname,
  desc: 'This command-line-interface (CLI) allows you to easily perform custom tasks for your vendhq.com instance.' +
  '\n\t' + 'Usage:' +
  '\n\t\t' + 'vend-tools COMMAND --domain <vendSubDomain> [OPTIONS]',
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
      aliases: ['f']
    }
  }
});

if (process.env['User-Agent']) {
  process.env['User-Agent'] += '.vend-tools';
}
else {
  process.env['User-Agent'] = 'vend-tools';
}
console.log('process.env[\'User-Agent\']', process.env['User-Agent']);

program.run();
