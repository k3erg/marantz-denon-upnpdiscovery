/**
    @fileoverview Find marantz and Denon AVRs advertising their services by upnp.

    @author Mike Kronenberg <mike.kronenberg@kronenberg.org> (http://www.kronenberg.org)
    @license MIT
*/



var dgram = require('dgram');
var arp = require('node-arp');
var request = require('request');
var parseString = require('xml2js').parseString;



/**
    Find Denon and marantz devices advertising their services by upnp.
    @param {function} callback .
    @constructor
*/
function MarantzDenonUPnPDiscovery(callback) {
    var that = this;
    var foundDevices = {};                                                      // only report a device once

    // create socket
    var socket = dgram.createSocket({type: 'udp4', reuseAddr: true});
    socket.unref();
    const search = new Buffer([
        'M-SEARCH * HTTP/1.1',
        'HOST: 239.255.255.250:1900',
        'ST: upnp:rootdevice',
        'MAN: "ssdp:discover"',
        'MX: 3',
        '',
        ''
    ].join('\r\n'));

    socket.on('error', function(err) {
        console.log(`server error:\n${err.stack}`);
        socket.close();
    });

    socket.on('message', function(message, rinfo) {
        var messageString = message.toString();
        console.log(messageString);
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

    socket.on('listening', function() {
        socket.addMembership('239.255.255.250');
        socket.setMulticastTTL(4);
        const address = socket.address();
        console.log(`server listening ${address.address}:${address.port}`);
        socket.send(search, 0, search.length, 1900, '239.255.255.250');
        setTimeout(function() {socket.close();}, 5000);
    });

    socket.bind(0);
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
                    if (result.root.device[0].firmware_version) {
                        device.firmwareVersion = result.root.device[0].firmware_version ? result.root.device[0].firmware_version[0] : '';
                    } else if (result.root.device[0].deviceList) {
                        var i;
                        for (i = 0; i < result.root.device[0].deviceList[0].device.length; i++) {
                            if (result.root.device[0].deviceList[0].device[i].firmware_version) {
                                device.firmwareVersion = result.root.device[0].deviceList[0].device[i].firmware_version[0];
                                break;
                            }
                        }
                    }
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
