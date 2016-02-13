/**
 * Copyright 2016 Dave Thwaites
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
        throw "Error : ener314 script needs to be executable.";
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


    function ener002(n) {
        RED.nodes.createNode(this,n);
        this.pimote = RED.nodes.getNode(n.pimote);
        this.socket = n.socket;
        this.set = n.set || false;
        this.state = n.state || 0;
        var node = this;

        if (this.pimote) {
            // Pi-mote node configured! :-)
            if (RED.settings.verbose) { node.log("Pi-mote node: '"+n.pimote+"'"); }
            if (RED.settings.verbose) { node.log("Pi-mote board: '"+node.pimote.board+"'"); }
        } else {
            // No Pi-mote node configured...
            if (RED.settings.verbose) { node.log("No Pi-mote node configured..."); }
        }

        function inputlistener(msg) {
            if (msg.payload === "true") { msg.payload = true; }
            if (msg.payload === "false") { msg.payload = false; }
            var out = msg.payload.toString().trim().toLowerCase();
            if (out == "on" || out == "off") {
                out = "O"+out.substring(1);
                if (RED.settings.verbose) { node.log("input: '"+msg.payload+"' => '"+out+"'"); }
                if (node.child !== null) {
                    node.child.stdin.write(this.socket+" "+out+"\n");
                    node.status({fill:"green", shape:"ring", text:out});
                } else {
                    node.warn("Command not running");
                    node.status({fill:"red", shape:"dot", text:"Not Running"});
                }
            }
            else { node.warn("Invalid input: '"+out+"'"); }
        }

        if (node.socket !== undefined) {
            node.child = spawn(gpioCommand, []);
            if (node.set) {
                node.child.stdin.write(node.socket+" "+node.state+"\n");
                node.status({fill:"green",shape:"ring",text:node.state});
            } else {
                node.status({fill:"green",shape:"ring",text:"OK"});
            }
            node.running = true;
            node.done = false;

            node.on("input", inputlistener);

            node.child.stdout.on('data', function (data) {
                var text=data.toString().trim();
                if (RED.settings.verbose) { node.log("output: '"+text+"'"); }
                if (text == "Starting background thread...") { node.status({fill:"green",shape:"dot",text:"OK"}); }
            });

            node.child.stderr.on('data', function (data) {
                var text=data.toString().trim();
                if (RED.settings.verbose) { node.log("error: '"+text+"'"); }
            });

            node.child.on('close', function (code, signal) {
                node.status({fill:"red", shape:"dot", text:"Closed"});
                if (RED.settings.verbose) {
                    if (code != null) node.log("close: code '"+code+"'");
                    if (signal != null) node.log("close: signal '"+signal+"'");
                }
                node.child = null;
                node.running = false;
                if (node.done) { node.done(); }
            });

            node.child.on('exit', function (code, signal) {
                if (RED.settings.verbose) {
                    if (code != null) node.log("exit: code '"+code+"'");
                    if (signal != null) node.log("exit: signal '"+signal+"'");
                }
            });

            node.child.on('error', function (err) {
                if (err.errno === "ENOENT") { node.warn('Command not found'); }
                else if (err.errno === "EACCES") { node.warn('Command not executable'); }
                else { node.log('error: ' + err); }
            });

        } else {
            node.error("Invalid ENER314 socket: "+node.socket);
        }

        node.on("close", function(done) {
            if (node.child != null) {
                node.done = done;
                // node.child.stdin.write("exit");
                node.child.kill('SIGKILL');
                // node.child.kill('SIGINT');
            }
            node.status({fill:"red", shape:"ring", text:"Closing..."});
            if (RED.settings.verbose) { node.log("closing..."); }
            if (node.child == null) { done(); }
        });

    }
    RED.nodes.registerType("ener002",ener002);



    function pimote(n) {
        RED.nodes.createNode(this,n);
        this.board = n.board;
        this.defaultpins = n.defaultpins || false;
        this.d0 = n.d0 || 0;
        this.d1 = n.d1 || 0;
        this.d2 = n.d2 || 0;
        this.d3 = n.d3 || 0;
        this.modsel = n.modsel || 0;
        this.enable = n.enable || 0;
        var node = this;
        if (RED.settings.verbose) {
            node.log("board type: '"+this.board+"'");
            node.log("use default pins: '"+this.defaultpins+"'");
            node.log("node name: '"+n.name+"'");
        }

/*
        if (node.socket !== undefined) {
            node.child = spawn(gpioCommand, []);
            if (node.set) {
                node.child.stdin.write(node.socket+" "+node.state+"\n");
                node.status({fill:"green",shape:"ring",text:node.state});
            } else {
                node.status({fill:"green",shape:"ring",text:"OK"});
            }
            node.running = true;

            node.on("input", inputlistener);

            node.child.stdout.on('data', function (data) {
                if (RED.settings.verbose) { node.log("out: '"+data+"'"); }
                if (data.toString().trim() == "Starting background thread...") { node.status({fill:"green",shape:"dot",text:"OK"}); }
            });

            node.child.stderr.on('data', function (data) {
                if (RED.settings.verbose) { node.log("err: '"+data+"'"); }
            });

            node.child.on('close', function (code) {
                if (RED.settings.verbose) { node.log("ret: '"+code+"'"); }
                node.child = null;
                node.running = false;
                node.status({fill:"red", shape:"ring", text:"Closed"});
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
            node.status({fill:"red", shape:"dot", text:"Closed"});
            if (RED.settings.verbose) { node.log("end"); }
        });
*/

    }
    RED.nodes.registerType("pimote",pimote);



/*
    RED.httpAdmin.get('/rpi-pibpins/:id',RED.auth.needsPermission('rpi-pibrella.read'),function(req,res) {
        res.json(pinsInUse);
    });
*/
}
