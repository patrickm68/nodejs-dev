<h1 align="center">instana-nodejs-sensor</h1>
<p align="center">Monitor your Node.js applications with Instana</p>

## Installation
Install the Instana Node.js sensor for production usage:

```
npm install --save instana-nodejs-sensor
```

The Node.js sensor requires native addons. These addons are compiled automatically for your system and Node.js version when you execute the command you see above. In order for this to work the system needs to have tools like `make` and `g++` installed. These tools can often be installed via a bundle called `build-essential` or similar (depending on your package manager and registry).

```
sudo apt-get install build-essential
```

## Activation
Now that the sensor is installed, it needs to be activated from within your application. You do this by requiring it as the *first line* in your application.

```javascript
require('instana-nodejs-sensor')();
```

## Enable Logging
This sensor is using the [debug](https://www.npmjs.com/package/debug) module. To enable logging, set the `DEBUG=instana-nodejs-sensor:*` environment variable before starting your app. Example:

```
DEBUG=instana-nodejs-sensor:* npm start
```
