const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'AntivirusServer',
  description: 'Antivirus Server (Windows Defender wrapper)',
  script: path.join(__dirname, '..', 'src', 'server.js'),
});

svc.on('install', () => {
  console.log('Service installed. Starting...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service already installed. Starting...');
  svc.start();
});

svc.on('start', () => {
  console.log('Service started. It will run as LocalSystem with elevated privileges.');
});

svc.on('error', (err) => {
  console.error('Service error:', err && (err.stack || err));
});

svc.install();
