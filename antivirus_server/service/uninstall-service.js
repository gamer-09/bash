const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'AntivirusServer',
  script: path.join(__dirname, '..', 'src', 'server.js'),
});

svc.on('uninstall', () => {
  console.log('Service uninstalled.');
});

svc.on('error', (err) => {
  console.error('Service error:', err && (err.stack || err));
});

svc.uninstall();
