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



    function ener002(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.pimote = RED.nodes.getNode(n.pimote);
        node.socket = n.socket;
        node.set = n.set || false;
        node.state = n.state || 0;

        function inputlistener(msg) {
            if (msg.payload === "true") { msg.payload = true; }
            if (msg.payload === "false") { msg.payload = false; }
            var out = msg.payload.toString().trim().toLowerCase();
            if (out == "on" || out == "off") {
                out = "O"+out.substring(1);
                if (RED.settings.verbose) { node.log("input: '"+msg.payload+"' => '"+node.socket+" "+out+"'"); }
                if (node.pimote.child !== null) {
                    node.pimote.child.stdin.write(node.socket+" "+out+"\n");
                    node.status({fill:"green", shape:"ring", text:out});
                } else {
                    node.warn("Command not running");
                    node.status({fill:"red", shape:"dot", text:"Not Running"});
                }
            }
            else { node.warn("Invalid input: '"+out+"'"); }
        }

        if (node.pimote) {
            // Pi-mote node configured! :-)
            if (RED.settings.verbose) { node.log("Pi-mote node: '"+n.pimote+"'"); }
            if (RED.settings.verbose) { node.log("Pi-mote board: '"+node.pimote.board+"'"); }

            if (node.socket !== undefined) {
                if (node.set) {
                    node.pimote.child.stdin.write(node.socket+" "+node.state+"\n");
                    node.status({fill:"green",shape:"ring",text:node.state});
                } else {
                    node.status({fill:"green",shape:"ring",text:"OK"});
                }

                node.on("input", inputlistener);

                node.pimote.child.stdout.on('data', function (data) {
                    var text=data.toString().trim().split('\n');
                    for (var i = 0; i < text.length; i++) {
                        if (text[i] == "Starting background thread...") { node.status({fill:"green",shape:"dot",text:"OK"}); }
                    }
                });

                // node.pimote.child.stderr.on('data', function (data) {
                //     var text=data.toString().trim();
                // });

                node.pimote.child.on('close', function (code, signal) {
                    node.status({fill:"red", shape:"dot", text:"Closed"});
                });

                // node.pimote.child.on('exit', function (code, signal) {
                // });

                // node.pimote.child.on('error', function (err) {
                // });

            } else {
                node.error("Invalid ENER314 socket: "+node.socket);
            }
        } else {
            // No Pi-mote node configured...
            node.error("No Pi-mote node configured");
        }

        node.on("close", function() {
            node.status({fill:"red", shape:"ring", text:"Closing..."});
        });

    }
    RED.nodes.registerType("ener002",ener002);



    function pimote(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.board = n.board;
        node.defaultpins = n.defaultpins || false;
        node.d0 = n.d0 || 0;
        node.d1 = n.d1 || 0;
        node.d2 = n.d2 || 0;
        node.d3 = n.d3 || 0;
        node.modsel = n.modsel || 0;
        node.enable = n.enable || 0;

        if (RED.settings.verbose) {
            node.log("board type: '"+node.board+"'");
            node.log("use default pins: '"+node.defaultpins+"'");
            node.log("node name: '"+n.name+"'");
        }

        if (node.board == "ener314") {
            node.child = spawn(gpioCommand, []);
            node.running = true;
            node.done = false;

            node.child.stdout.on('data', function (data) {
                var text=data.toString().trim().split('\n');
                for (var i = 0; i < text.length; i++) {
                    if (RED.settings.verbose) { node.log("output: '"+text[i]+"'"); }
                }
            });

            node.child.stderr.on('data', function (data) {
                var text=data.toString().trim().split('\n');
                for (var i = 0; i < text.length; i++) {
                    if (RED.settings.verbose) { node.log("error: '"+text[i]+"'"); }
                }
            });

            node.child.on('close', function (code, signal) {
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
            node.error("Unknown Pi-mote board type: '"+node.board+"'");
        }

        node.on("close", function(done) {
            if (RED.settings.verbose) { node.log("closing..."); }
            if (node.child != null) {
                node.done = done;
                // node.child.stdin.write("exit");
                node.child.kill('SIGKILL');
                // node.child.kill('SIGINT');
            } else {
                done();
            }
        });

    }
    RED.nodes.registerType("pimote",pimote);



/*
    RED.httpAdmin.get('/rpi-pibpins/:id',RED.auth.needsPermission('rpi-pibrella.read'),function(req,res) {
        res.json(pinsInUse);
    });
*/
}
