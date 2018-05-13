# marantz-denon-upnpdiscovery
Find marantz and Denon AVRs advertising their services by upnp.


## What does this package do?
It will initiate a upnp search and report all marantz and Denon devices it can find. It was written to support the [marantz-denon-telnet](https://www.npmjs.com/package/marantz-denon-telnet) and [homebridge-marantz-denon-telnet](https://www.npmjs.com/package/homebridge-marantz-denon-telnet) package.


## How to Install this package?
npm install marantz-denon-upnpdiscovery


## How to use this package?

```javascript



var MarantzDenonUPnPDiscovery = require('marantz-denon-upnpdiscovery');

/**
    Find Denon and marantz devices advertising their services by upnp.
    @param {function} callback .
*/
var mdf = new MarantzDenonUPnPDiscovery(function(error, device) {
    console.log(device);
});



```

## Tested on?

 * marantz SR7011



enjoy!
