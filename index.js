/**
    @fileoverview Find marantz and Denon AVRs advertising their services by upnp.

    @author Mike Kronenberg <mike.kronenberg@kronenberg.org> (http://www.kronenberg.org)
*/



var dgram = require('dgram');
var arp = require('node-arp');
var request = require('request');
var parseString = require('xml2js').parseString;



/**
    Find Denon and marantz devices advertising their services by upnp.
    @param {function} callback .
*/
function MarantzDenonUPnPDiscovery(callback) {
    var that = this;
    var foundDevices = {};                                                      // only report a device once

    // create socket
    const socket = dgram.createSocket({type: 'udp4', reuseAddr: true});

    // listen and send initial search for upnp root devices
    const search = new Buffer([
        'M-SEARCH * HTTP/1.1',
        'HOST: 239.255.255.250:1900',
        'MAN: "ssdp:discover"',
        'MX: 3',
        'ST: upnp:rootdevice'
    ].join('\r\n'));
    socket.on('listening', () => {
        socket.addMembership('239.255.255.250');
        socket.send(search, 0, search.length, 1900, '239.255.255.250');
    });

    // listen for denon urn
    socket.on('message', (message) => {
        var messageString = message.toString();
        if (messageString.match(/(d|D)enon/)) {
            location = messageString.match(/LOCATION: (.*?)(\d+\.\d+\.\d+\.\d+)(.*)/);
            if (location) {
                arp.getMAC(location[2], function(err, mac) {                    // lookup ip on the arp table to get the MacAddress
                    if (!err) {
                        if (foundDevices[mac]) {                                // only report foind devices once
                            return;
                        }
                        var device = {
                            friendlyName: '',
                            ip: location[2],
                            location: (location[1] + location[2] + location[3]).trim(),
                            mac: mac,
                            manufacturer: 'Unknown Manufacturer',
                            model: 'Unknown Model'
                        };
                        foundDevices[mac] = device;
                        that.getUPnPInfo(device, function() {
                            if (device.manufacturer == 'Unknown Manufacturer') { // still no info?
                                that.getDeviceInfo(device, function() {callback(null, device);}, 80);
                            } else {
                                callback(null, device);
                            }
                        });
                    }
                });
        	}
        }
    });

    // go
    socket.bind(1900);
    setTimeout(function() {socket.close();}, 5000);
}



/**
    Try to get device Info from UPnP.
    @param {object} device .
    @param {Function} callback .
*/
MarantzDenonUPnPDiscovery.prototype.getUPnPInfo = function(device, callback) {
    request.get(device.location, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            parseString('' + body, function(err, result) {
                if (result.root.device) {
                    device.friendlyName = result.root.device[0].friendlyName[0] || '';
                    device.manufacturer = result.root.device[0].manufacturer[0] || device.manufacturer;
                    device.model = result.root.device[0].modelName[0] || device.model;
                    device.friendlyName = device.friendlyName.replace(/^ACT-/, ''); // clean out UPnP junk
                    device.manufacturer = device.manufacturer.replace(/^ACT-/, ''); // clean out UPnP junk
                    device.model = device.model.replace(device.manufacturer + ' ', ''); // separate model from manufacturer
                }
            });
        }
        callback(null, device);                                                 // whatever happens, we finally go on
    });
};



/**
    Try to get info about the device.
    First try on Port 80 for non-HEOS models, then 8080 for HEOS-models.
    @param {object} device .
    @param {Function} callback .
    @param {number} port .
*/
MarantzDenonUPnPDiscovery.prototype.getDeviceInfo = function(device, callback, port) {
    var that = this;

    request.get('http://' + device.ip + ':' + port + '/goform/Deviceinfo.xml', function(error, response, body) {
        if (!error && response.statusCode === 403 && port === 80) {             // TODO: check what a Denon marantz without HEOS will report
            that.getDeviceInfo(device, callback, 8080);
            return;
        } else if (!error && response.statusCode === 200) {
            parseString('' + body, function(err, result) {
                var deviceBrandCode = parseInt(result.Device_Info.BrandCode, 10) || 9999;
                device.manufacturer = ['Denon', 'marantz'][deviceBrandCode] || device.manufacturer;
                device.model = result.Device_Info.ModelName[0] || device.model;
            });
        } else {
            console.log('error: ' + error);
        }
        callback(null, device);                                                 // whatever happens, we finally go on
    });
};



/**
    Export.
*/
module.exports = MarantzDenonUPnPDiscovery;
