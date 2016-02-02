/**
 * Copyright 2015 Dave Thwaites
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var util = require("util");
    var spawn = require('child_process').spawn;
    var fs = require('fs');

    var gpioCommand = __dirname+'/ener314';

    if (!fs.existsSync("/dev/ttyAMA0")) { // unlikely if not on a Pi
        util.log("Info : Ignoring Raspberry Pi specific node (rpi-ener314).");
        throw "Info : Ignoring Raspberry Pi specific node (rpi-ener314).";
    }

    if (!fs.existsSync("/usr/share/doc/python-rpi.gpio")) {
        util.log("[rpi-ener314] Warning : Can't find RPi.GPIO python library.");
        throw "Warning : Can't find RPi.GPIO python library.";
    }

    if ( !(1 & parseInt ((fs.statSync(gpioCommand).mode & parseInt ("777", 8)).toString (8)[0]) )) {
        util.log("[rpi-ener314] Error : "+gpioCommand+" needs to be executable.");
        throw "Error : ever314.py needs to be executable.";
    }


/*
    function PibrellaIn(n) {
        RED.nodes.createNode(this,n);
        this.buttonState = -1;
        this.pin = pintable[n.pin];
        this.read = n.read || false;
        if (this.read) { this.buttonState = -2; }
        var node = this;
        if (!pinsInUse.hasOwnProperty(this.pin)) {
            pinsInUse[this.pin] = "tri";
        }
        else {
            if ((pinsInUse[this.pin] !== "tri")||(pinsInUse[this.pin] === "pwm")) {
                node.error("GPIO pin "+this.pin+" already set as "+pinTypes[pinsInUse[this.pin]]);
            }
        }

        if (node.pin !== undefined) {
            node.child = spawn(gpioCommand, ["in",node.pin]);
            node.running = true;
            node.status({fill:"green",shape:"dot",text:"OK"});

            node.child.stdout.on('data', function (data) {
                data = data.toString().trim();
                if (data.length > 0) {
                    if (node.buttonState !== -1) {
                        node.send({ topic:"pibrella/"+tablepin[node.pin], payload:Number(data) });
                    }
                    node.buttonState = data;
                    node.status({fill:"green",shape:"dot",text:data});
                    if (RED.settings.verbose) { node.log("out: "+data+" :"); }
                }
            });

            node.child.stderr.on('data', function (data) {
                if (RED.settings.verbose) { node.log("err: "+data+" :"); }
            });

            node.child.on('close', function (code) {
                if (RED.settings.verbose) { node.log("ret: "+code+" :"); }
                node.child = null;
                node.running = false;
                node.status({fill:"red",shape:"circle",text:""});
            });

            node.child.on('error', function (err) {
                if (err.errno === "ENOENT") { node.warn('Command not found'); }
                else if (err.errno === "EACCES") { node.warn('Command not executable'); }
                else { node.log('error: ' + err); }
            });

        }
        else {
            node.error("Invalid GPIO pin: "+node.pin);
        }

        node.on("close", function() {
            if (node.child != null) {
                node.child.stdin.write(" close "+node.pin);
                node.child.kill('SIGKILL');
            }
            node.status({fill:"red",shape:"circle",text:""});
            delete pinsInUse[node.pin];
            if (RED.settings.verbose) { node.log("end"); }
        });
    }
    RED.nodes.registerType("rpi-pibrella in",PibrellaIn);
*/


    function ener314(n) {
        RED.nodes.createNode(this,n);
        this.socket = n.socket;
        this.set = n.set || false;
        this.state = n.state || 0;
        var node = this;

        function inputlistener(msg) {
            if (msg.payload === "true") { msg.payload = true; }
            if (msg.payload === "false") { msg.payload = false; }
            var out = Number(msg.payload);
            if ((out >= 0) && (out <= 1)) {
                if (RED.settings.verbose) { node.log("inp: "+msg.payload); }
                if (node.child !== null) { node.child.stdin.write(this.socket+" "+out+"\n"); }
                else { node.warn("Command not running"); }
                node.status({fill:"green",shape:"ring",text:msg.payload});
            }
            else { node.warn("Invalid input: "+out); }
        }

        if (node.socket !== undefined) {
            node.child = spawn(gpioCommand, []);
            if (node.set) {
                node.child.stdin.write(node.socket+" "+node.state+"\n");
                node.status({fill:"green",shape:"ring",text:node.state});
            } else {
                node.status({fill:"green",shape:"dot",text:"OK"});
            }
            node.running = true;

            node.on("input", inputlistener);

            node.child.stdout.on('data', function (data) {
                if (RED.settings.verbose) { node.log("out: "+data+" :"); }
            });

            node.child.stderr.on('data', function (data) {
                if (RED.settings.verbose) { node.log("err: "+data+" :"); }
            });

            node.child.on('close', function (code) {
                if (RED.settings.verbose) { node.log("ret: "+code+" :"); }
                node.child = null;
                node.running = false;
                node.status({fill:"red",shape:"ring",text:""});
            });

            node.child.on('error', function (err) {
                if (err.errno === "ENOENT") { node.warn('Command not found'); }
                else if (err.errno === "EACCES") { node.warn('Command not executable'); }
                else { node.log('error: ' + err); }
            });

        } else {
            node.error("Invalid ENER314 socket: "+node.socket);
        }

        node.on("close", function() {
            if (node.child != null) {
                node.child.stdin.write("exit");
                node.child.kill('SIGKILL');
            }
            node.status({fill:"red",shape:"ring",text:""});
            if (RED.settings.verbose) { node.log("end"); }
        });

    }
    RED.nodes.registerType("rpi-ener314",ener314);

/*
    RED.httpAdmin.get('/rpi-pibpins/:id',RED.auth.needsPermission('rpi-pibrella.read'),function(req,res) {
        res.json(pinsInUse);
    });
*/
}
