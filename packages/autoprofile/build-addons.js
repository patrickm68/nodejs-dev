var os = require('os');
var fs = require('fs');
var cp = require('child_process');

cp.execSync('npm update node-abi', { stdio: [0, 1, 2] });
var nodeAbi = require('node-abi');

cp.execSync('npm update node-gyp', { stdio: [0, 1, 2] });

var versions = [
  'v4.0.0',
  'v4.1.0',
  'v4.1.1',
  'v4.1.2',
  'v4.2.0',
  'v4.2.1',
  'v4.2.2',
  'v4.2.3',
  'v4.2.4',
  'v4.2.5',
  'v4.2.6',
  'v4.3.0',
  'v4.3.1',
  'v4.3.2',
  'v4.4.0',
  'v4.4.1',
  'v4.4.2',
  'v4.4.3',
  'v4.4.4',
  'v4.4.5',
  'v4.4.6',
  'v4.4.7',
  'v4.5.0',
  'v4.6.0',
  'v4.6.1',
  'v4.6.2',
  'v4.7.0',
  'v4.7.1',
  'v4.7.2',
  'v4.7.3',
  'v4.8.0',
  'v4.8.1',
  'v4.8.2',
  'v4.8.3',
  'v4.8.4',
  'v5.0.0',
  'v5.1.0',
  'v5.1.1',
  'v5.10.0',
  'v5.10.1',
  'v5.11.0',
  'v5.11.1',
  'v5.12.0',
  'v5.2.0',
  'v5.3.0',
  'v5.4.0',
  'v5.4.1',
  'v5.5.0',
  'v5.6.0',
  'v5.7.0',
  'v5.7.1',
  'v5.8.0',
  'v5.9.0',
  'v5.9.1',
  'v6.0.0',
  'v6.1.0',
  'v6.10.0',
  'v6.10.1',
  'v6.10.2',
  'v6.10.3',
  'v6.11.0',
  'v6.11.1',
  'v6.11.2',
  'v6.11.3',
  'v6.11.4',
  'v6.11.5',
  'v6.12.0',
  'v6.12.1',
  'v6.12.2',
  'v6.12.3',
  'v6.13.0',
  'v6.13.1',
  'v6.13.2',
  'v6.14.0',
  'v6.14.1',
  'v6.14.2',
  'v6.14.3',
  'v6.14.4',
  'v6.15.0',
  'v6.15.1',
  'v6.16.0',
  'v6.17.0',
  'v6.17.1',
  'v6.2.0',
  'v6.2.1',
  'v6.2.2',
  'v6.3.0',
  'v6.3.1',
  'v6.4.0',
  'v6.5.0',
  'v6.6.0',
  'v6.7.0',
  'v6.8.0',
  'v6.8.1',
  'v6.9.0',
  'v6.9.1',
  'v6.9.2',
  'v6.9.3',
  'v6.9.4',
  'v6.9.5',
  'v7.0.0',
  'v7.1.0',
  'v7.10.0',
  'v7.10.1',
  'v7.2.0',
  'v7.2.1',
  'v7.3.0',
  'v7.4.0',
  'v7.5.0',
  'v7.6.0',
  'v7.7.1',
  'v7.7.2',
  'v7.7.3',
  'v7.7.4',
  'v7.8.0',
  'v7.9.0',
  'v8.0.0',
  'v8.1.0',
  'v8.1.1',
  'v8.1.2',
  'v8.1.3',
  'v8.1.4',
  'v8.2.0',
  'v8.2.1',
  'v8.3.0',
  'v8.4.0',
  'v8.5.0',
  'v8.6.0',
  'v8.7.0',
  'v8.8.0',
  'v8.8.1',
  'v8.9.0',
  'v8.9.1',
  'v8.9.2',
  'v8.9.3',
  'v8.9.4',
  'v8.10.0',
  'v8.11.0',
  'v8.11.1',
  'v8.11.2',
  'v8.11.3',
  'v8.11.4',
  'v8.12.0',
  'v8.13.0',
  'v8.14.0',
  'v8.14.1',
  'v8.15.0',
  'v8.16.0',
  'v8.16.1',
  'v8.16.2',
  'v8.17.0',
  'v9.0.0',
  'v9.1.0',
  'v9.2.0',
  'v9.2.1',
  'v9.3.0',
  'v9.4.0',
  'v9.5.0',
  'v9.6.0',
  'v9.6.1',
  'v9.7.0',
  'v9.7.1',
  'v9.8.0',
  'v9.9.0',
  'v9.10.0',
  'v9.10.1',
  'v9.11.0',
  'v9.11.1',
  'v9.11.2',
  'v10.0.0',
  'v10.1.0',
  'v10.2.0',
  'v10.2.1',
  'v10.3.0',
  'v10.4.0',
  'v10.4.1',
  'v10.5.0',
  'v10.6.0',
  'v10.7.0',
  'v10.8.0',
  'v10.9.0',
  'v10.10.0',
  'v10.11.0',
  'v10.12.0',
  'v10.13.0',
  'v10.14.0',
  'v10.14.1',
  'v10.14.2',
  'v10.15.0',
  'v10.15.1',
  'v10.15.2',
  'v10.15.3',
  'v10.16.0',
  'v10.16.1',
  'v10.16.2',
  'v10.16.3',
  'v10.16.4',
  'v10.17.0',
  'v10.18.0',
  'v10.19.0',
  'v10.20.0',
  'v10.20.1',
  'v10.21.0',
  'v10.22.0',
  'v11.0.0',
  'v11.1.0',
  'v11.2.0',
  'v11.3.0',
  'v11.4.0',
  'v11.5.0',
  'v11.6.0',
  'v11.7.0',
  'v11.8.0',
  'v11.9.0',
  'v11.10.0',
  'v11.10.1',
  'v11.11.0',
  'v11.12.0',
  'v11.13.0',
  'v11.14.0',
  'v11.15.0',
  'v12.0.0',
  'v12.1.0',
  'v12.2.0',
  'v12.3.0',
  'v12.3.1',
  'v12.4.0',
  'v12.5.0',
  'v12.6.0',
  'v12.7.0',
  'v12.8.0',
  'v12.8.1',
  'v12.9.0',
  'v12.9.1',
  'v12.10.0',
  'v12.11.0',
  'v12.11.1',
  'v12.12.0',
  'v12.13.0',
  'v12.13.1',
  'v12.14.0',
  'v12.14.1',
  'v12.15.0',
  'v12.16.0',
  'v12.16.1',
  'v12.16.2',
  'v12.16.3',
  'v12.17.0',
  'v12.18.0',
  'v12.18.1',
  'v12.18.2',
  'v12.18.3',
  'v13.0.0',
  'v13.0.1',
  'v13.1.0',
  'v13.2.0',
  'v13.3.0',
  'v13.4.0',
  'v13.5.0',
  'v13.6.0',
  'v13.7.0',
  'v13.8.0',
  'v13.9.0',
  'v13.10.0',
  'v13.10.1',
  'v13.11.0',
  'v13.12.0',
  'v13.13.0',
  'v13.14.0',
  'v14.0.0',
  'v14.1.0',
  'v14.2.0',
  'v14.3.0',
  'v14.4.0',
  'v14.5.0',
  'v14.6.0',
  'v14.7.0',
  'v14.8.0',
  'v14.9.0'
];

let abiMap = {};

let platform = os.platform();
if (process.argv[2]) {
  platform = process.argv[2];
}

console.log(`Building addons for platform ${platform}.`);

let addonDir = `addons/${platform}-${process.arch}`;
if (!fs.existsSync(addonDir)) {
  fs.mkdirSync(addonDir);
}

versions.forEach(version => {
  console.log(`Compiling version ${version}.`)
  let abi = nodeAbi.getAbi(version);

  // not compiling very old versions on Mac
  if ((platform == 'darwin' || platform == 'win32') && abi < 57) {
    return;
  }

  let addonPath = `${addonDir}/autoprofile-addon-v${abi}.node`;

  if (!fs.existsSync(addonPath)) {
    cp.execSync(`node node_modules/node-gyp/bin/node-gyp.js rebuild --target=${version} --arch=x64`, {
      stdio: [0, 1, 2]
    });
    fs.copyFileSync('build/Release/autoprofile-addon.node', addonPath);
  } else {
    console.log(`Addon with ABI ${abi} exists, skipping.`);
  }

  abiMap[version] = abi;
});

fs.writeFileSync('abi-map.json', JSON.stringify(abiMap));
