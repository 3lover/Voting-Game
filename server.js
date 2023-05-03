// initialize our dependancies
const express = require('express');
const cors = require("cors");
const WebSocket = require("express-ws");
const web = express();
const app = express();
const http = require('http');
const server = http.createServer();
const port = 3000;

// setup the websockets we will be using in order to send data from the server to client
const sockets = {
  tally: 1,
  clients: [],
	protocol: (() => {
		const encoder = new TextEncoder().encode.bind(new TextEncoder());
		const decoder = new TextDecoder().decode.bind(new TextDecoder());
		return {
			encode: (message) => encoder(JSON.stringify(message)).buffer,
			decode: (message) => JSON.parse(decoder(message.data)),
		};
	})(),
  class: class {
    constructor(socket, request) {
      this.id = sockets.tally++;
      
      this.socket = socket;
      this.request = request;
      this.socket.binaryType = "arraybuffer";
      
      socket.onerror = error => this.error(error);
      socket.onclose = reason => this.close(reason);
      socket.onmessage = data => this.message(data);
    }

		// when we recieve a request try to fufill it
    message(packet) {
      packet = sockets.protocol.decode(packet);
			switch (packet.shift()) {
				case "console": {
					console.log(packet);
					break;
				}
				case "getdata": {
					let datasent = {};
          let e = false;
					for (let i of entities) 
						if (i.clientbound === this.id)
							if (e !== false) console.log("Uh Oh Spaghettio 2 things have the same client");
							else e = i;
					if (e === false) return;
          
					if (packet.includes("currentviewers")) datasent.players = sockets.clients.length;
					if (packet.includes("serverspeed")) datasent.serverspeed = serverspeed[1];
					this.socket.send(sockets.protocol.encode(["data", datasent]));
					break;
				}
				case "savesetup": {
					let ids = [];
					db.each("SELECT * from SavedSet", (err, row) => {
      			if (row) {
      				ids.push(JSON.parse(row.save).setupID);
      			}
    			}, err => {});
					let savedpack = {setupID: newID("setup", 4, ids), setup: packet[0]}
					db.run(`INSERT INTO SavedSet (save) VALUES (?)`, JSON.stringify(savedpack), error => {});
					console.log(savedpack)
					break;
				}
				case "sendem": {
					db.each("SELECT * from SavedSet", (err, row) => {
      			if (row) {
      				let data = JSON.parse(row.save);
							console.log(data);
      			}
    			}, err => {});
				}
				case "loadsetup": {
					let foundsetup = null;
					db.each("SELECT * from SavedSet", (err, row) => {
      			if (row) {
      				let data = JSON.parse(row.save);
							if (data.setupID == packet[0]) foundsetup = data.setup;
      			}
    			},
  				err => {});
					if (foundsetup === null) return;
					this.talk(["askNrecieve", foundsetup]);
					break;
				}
				case "log": {
					console.log(packet[0]);
					break;
				}
        case "sendNewSettings": {
          let e = false;
					for (let i of entities) 
						if (i.clientbound === this.id)
							if (e !== false) console.log("Uh Oh Spaghettio 2 things have the same client");
							else e = i;
					if (e === false) return;
          
          if (lobbies[e.lobby].currentdata.inlobby) {
            e.mysettings = packet[0];
            if (e.host) {
              lobbies[e.lobby].hostsettings = e.mysettings;
              for (let g = 0; g < entities.length; g++) {
                let k = entities[g];
                if (k.lobby == e.lobby) {
                  switch (k.type) {
                    case "tank": {
                      let powerupS = packet[0].powerups.loadout;
                      k.shotcounts = new Array(powerupS.length).fill(0);
                      k.shotcounts[0] = helpers.ran(powerupS[0].properties.shotsPerRound[0], powerupS[0].properties.shotsPerRound[1], 1);
                      k.roundcounts = new Array(powerupS.length).fill(0);
                      k.roundcounts[0] = 1;
                      k.reloadcounts = new Array(powerupS.length).fill(0);
                      k.poweruptype = 0;

                      helpers.validateClientSettings(k, lobbies[k.lobby].hostsettings, FPS, entities);
                      break;
                    }
                    case "powerup":
                    case "bullet": {
                      k.kill();
                      break;
                    }
                  }
                }
              }
              for (let g of sockets.clients) {
                let w = false;
                for (let o of entities) 
                  if (o.clientbound === g.id)
                    if (w !== false) console.log("Uh Oh Spaghettio 2 things have the same client");
                    else w = o;
					      if (w === false) continue;
                if (w.lobby != e.lobby) continue;
                g.talk(["hostSettings", lobbies[e.lobby].hostsettings]);
                g.talk(["hostChange"]);
              }
            }
            else helpers.validateClientSettings(e, lobbies[e.lobby].hostsettings, FPS, entities);
            // if not a host, who cares?
          }
          break;
        }
				case "getlobbies": {
					let lobbysend = [];
					for (let l of lobbies) if (l.hostsettings.lobby.gameControl.lobbyAvailability === 1) lobbysend.push({id: l.id, info: l.hostsettings, current: l.currentdata});
					this.talk(["lobbies", lobbysend]);
					break;
				}
				case "host": {
					let o = createtank(true, packet[0], lobbies.length, this.id);
					entities.push(o);
					
					let set = o.mysettings;
					let code = packet[1].length >= 1 ? packet[1] : newID("lobby", 5, lobbies);
					for (let l of lobbies) if (l.id == code) {
						this.kick(["Duplicate Code", `The code '${code}' is already in use. Try creating a lobby with a different code, or if you meant to join this lobby go to the Join a Lobby page and enter it.`]);
						return;
					}
					lobbies.push({
						id: code,
            hostsettings: o.mysettings,
						currentdata: {
              players: 1,
              mapsize: [10000, 10000],
              wrapmap: 1,
              maze: helpers.mazearray(10, 10, 50),
              inlobby: true,
              roundOver: false,
              finaltimer: 0,
              round: 0,
              updatePaused: 0,
              waitingTimer: [0, () => {}],
              powerups: [0, 0]
            }
					});
          createwaiting(o.lobby);
          
          helpers.validateClientSettings(o, lobbies[o.lobby].hostsettings, FPS, entities);
					
					console.log(o.lobby + " created with id " + lobbies[o.lobby].id);
					this.talk(["connected"]);
					break;
				}
				case "join": {
					let mylobby = null;
					for (let l in lobbies) {
						if (lobbies[l].id == packet[1] && lobbies[l].currentdata.players < lobbies[l].hostsettings.lobby.gameControl.maxPlayers) {
							mylobby = l;
						}
					}
					if (mylobby === null) {
						console.log("invalid join request");
						this.kick(["Lobby Not Found", `A lobby does not exist with the code '${packet[1]}'. If you believe this is an error, confirm with the host the lobby exists and submit a bug ticket in the discord.`]);
						return;
					}
					let o = createtank(false, packet[0], mylobby, this.id);
					entities.push(o);
					o.setpos(helpers.ranloc([0, 0], lobbies[o.lobby].currentdata.mapsize));
          helpers.validateClientSettings(o, lobbies[o.lobby].hostsettings, FPS, entities);
					console.log("player joined a lobby with id " + lobbies[o.lobby].id);
					lobbies[o.lobby].currentdata.players++;
					this.talk(["connected"]);
					break;
				}
				case "leave": {
					let e = false;
					let lobby = null;
					for (let i of entities) 
						if (i.clientbound === this.id)
							if (e !== false) console.log("Uh Oh Spaghettio 2 things have the same client");
							else e = i;
					if (e) {
						lobby = e.lobby;
						if (e.host && lobbies[lobby].currentdata.players > 0) 
							for (let h of entities) {
								if (h.lobby == e.lobby && h.clientbound && h != e) {
									h.host = true;
									break;
								}
							}
						e.killNextCycle = true;
						console.log(`Socket ${this.id} has left. Players in lobby: ${lobbies[e.lobby].currentdata.players}`);
						if (lobbies[e.lobby].currentdata.players <= 0) {
							lobbies.splice(e.lobby, 1);
							for (let u of entities) if (u.lobby > e.lobby) u.lobby--;
							console.log(`lobby ${e.lobby} is closed`);
						}
					}
					break;
				}
				case "you there?": {
					this.talk(["shut up im busy"]);
					break;
				}
				case "keys": {
					let e = false;
					for (let i of entities) 
						if (i.clientbound === this.id)
							if (e !== false) console.log("Uh Oh Spaghettio 2 things have the same client");
							else e = i;
					if (e === false) return;
					let devperms = packet[packet.length - 1] === process.env.SECRET;
					let hostperms = e.host;
					
					switch (packet.shift()) {
						case "leftarrow": {
							if (packet[0]) e.controlvector[0] = true;
							else e.controlvector[0] = false;
							this.talk(["log", "recieved and back"])
							break;
						}
						case "uparrow": {
							if (packet[0]) e.controlvector[1] = true;
							else e.controlvector[1] = false;
							break;
						}
						case "rightarrow": {
							if (packet[0]) e.controlvector[2] = true;
							else e.controlvector[2] = false;
							break;
						}
						case "downarrow": {
							if (packet[0]) e.controlvector[3] = true;
							else e.controlvector[3] = false;
							break;
						}
						case "fire": {
              if (packet[0]) e.controlvector[4] = true;
              else e.controlvector[4] = false;
							break;
						}
						case "big": {
							if (!devperms) break;
							e.radius *= 1.2;
							Body.scale(e.shape, 1.2, 1.2);
							Body.setMass(e.shape, e.shape.mass * (1.2**2));
							break;
						}
						case "small": {
							if (!devperms) break;
							e.radius *= 1/1.2;
							Body.scale(e.shape, 1/1.2, 1/1.2);
							Body.setMass(e.shape, e.shape.mass * (1/1.2**2));
							break;
						}
						case "heavy": {
							if (!devperms) break;
							helpers.shuffle(entities, e.lobby, ["tank", "box", "bullet"], ["tank", "box", "wall", "bullet"], 999, [0, 0], lobbies[e.lobby].currentdata.mapsize);
							break;
						}
						case "light": {
							if (!devperms) break;
							helpers.shuffle(entities, e.lobby, ["tank", "box", "wall", "bullet"], ["tank", "box", "wall", "bullet"], 999, [0, 0], lobbies[e.lobby].currentdata.mapsize);
							break;
						}
						case "testing0": {
							if (!devperms) break;
							e.rawvision *= 1.2;
							break;
						}
						case "testing1": {
							if (!devperms) break;
							e.rawvision /= 1.2;
							break;
						}
						case "biggerbubble": {
							if (!devperms) break;
							if (e.bubblevision * 1.2 < 100000) e.bubblevision *= 1.2;
							break;
						}
						case "smallerbubble": {
							if (!devperms) break;
							e.bubblevision /= 1.2;
							break;
						}
						case "speed": {
							if (!devperms) break;
							e.maxspeed *= 1.2;
							e.acceleration *= 1.2;
							break;
						}
						case "slow": {
							if (!devperms) break;
							e.maxspeed /= 1.2;
							e.acceleration /= 1.2;
							break;
						}
						case "testing2": {
							if (!hostperms && !devperms) break;
							let xdim = helpers.ran(4, 12, 1);
							let ydim = helpers.ran(4, 12, 1);
							let squaresize = 5000;
							lobbies[e.lobby].currentdata.mapsize[0] = squaresize * xdim;
							lobbies[e.lobby].currentdata.mapsize[1] = squaresize * ydim;
							for (let w = 0; w < entities.length; w++) 
							if (entities[w].type == "wall") entities[w].kill();
							lobbies[e.lobby].currentdata.maze = helpers.mazearray(xdim, ydim, xdim * ydim * helpers.ran(0.2, 0.8, 0.05), 0, [helpers.ran(0, 1, 1), helpers.ran(0, 1, 1)], helpers.ran(70, 100, 1));
							buildmaze(e.lobby);
							helpers.shuffle(entities, e.lobby, ["tank", "box"], ["tank", "box", "wall"], 999, [1, 1], lobbies[e.lobby].currentdata.mapsize);
							break;
						}
						case "testing3": {
							if (!hostperms && !devperms) break;
							let xdim = helpers.ran(10, 20, 1);
							let ydim = helpers.ran(10, 20, 1);
							let squaresize = 5000;
							lobbies[e.lobby].currentdata.mapsize[0] = squaresize * xdim;
							lobbies[e.lobby].currentdata.mapsize[1] = squaresize * ydim;
							for (let w = 0; w < entities.length; w++) 
							if (entities[w].type == "wall") entities[w].kill();
							lobbies[e.lobby].currentdata.maze = helpers.mazearray(xdim, ydim, xdim * ydim * helpers.ran(0.2, 0.8, 0.05), 0, [helpers.ran(0, 1, 1), helpers.ran(0, 1, 1)], helpers.ran(70, 100, 1));
							buildmaze(e.lobby);
							helpers.shuffle(entities, e.lobby, ["tank", "box"], ["wall"], 999, [1, 1], lobbies[e.lobby].currentdata.mapsize);
							break;
						}
            case "custommaze": {
              if (!hostperms && !devperms) break;
							let xdim = packet[1].xcomp;
							let ydim = packet[1].ycomp;
							let squaresize = packet[1].squaresize;
							lobbies[e.lobby].currentdata.mapsize[0] = squaresize * xdim;
							lobbies[e.lobby].currentdata.mapsize[1] = squaresize * ydim;
							for (let w = 0; w < entities.length; w++) 
							if (entities[w].type == "wall") entities[w].kill();
							lobbies[e.lobby].currentdata.maze = helpers.mazearray(xdim, ydim, xdim * ydim * packet[1].open, 0, [packet[1].clearx, packet[1].cleary], helpers.ran(70, 100, 1));
							buildmaze(e.lobby);
							helpers.shuffle(entities, e.lobby, ["tank", "box"], ["wall"], 999, [1, 1], lobbies[e.lobby].currentdata.mapsize);
              break;
            }
						case "testing4": {
							/*if (!devperms) break;
							let mass = helpers.ran(0, 5, 1);
							let colors = ["#3cff00", "#088a1a", "#0000ff", "#7c04b8", "#ffff00", "#ff0000"];
							let masses = [100, 500, 1000, 2000, 5000, 10000];
							let affixed = helpers.ranchance(10);
							let shape = helpers.ranshape({rect: 0, circ: 0, poly: 0, ran: 10}, {w: 2000, h: 2000}, {w: 6000, h: 6000}, {min: 3, max: 8});
							let o = new Entity({
								type: "box",
								lobby: e.lobby,
								shape: shape[0],
								color: affixed ? "#ffffff" : colors[mass],//`RGB(${mass * (260/5000)}, ${(2000 - mass) * (260/5000)}, 0)`,
								mass: masses[mass],
								bordercolor: affixed ? "#ff0000" : "#000000",
								strokesize: helpers.ran(20, 60, 1),
								static: affixed,
								svg: shape[1] ? shape[1] : undefined,
								rotation: helpers.ran(0, Math.PI * 2),
								rotationdamper: 2
							});
							entities.push(o);
							o.setpos(helpers.ranloc([0, 0], lobbies[e.lobby].currentdata.mapsize));*/
              if (lobbies[e.lobby].currentdata.inlobby) startRound(e.lobby);
              else {
                let r = lobbies[e.lobby].currentdata;
                let hr = lobbies[e.lobby].hostsettings;
                r.round++;
                if (r.round < hr.lobby.gameControl.roundsPerGame) {
                  r.updatePaused = 1;
                  r.waitingTimer = [FPS * hr.lobby.gameControl.roundEndTimer, () => {
                    startRound(e.lobby);
                    r.updatePaused = 2;
                    r.waitingTimer = [FPS * hr.lobby.gameControl.roundStartTimer, () => {
                      r.updatePaused = 0;
                    }];
                  }];
                }
                else {
                  r.updatePaused = 1;
                  r.waitingTimer = [FPS * hr.lobby.gameControl.roundEndTimer, () => {
                    createwaiting(e.lobby);
                    r.updatePaused = 0;
                  }];
                }
              }
							break;
						}
						case "testing5": {
							if (!devperms) break;
							for (let o = 0; o < entities.length; o++) {
                let eo = entities[o];
								if (eo.lobby != e.lobby) continue;
                if (eo.type == "tank") eo.poweruptype = 0;
                if (eo.type != "box" && eo.type != "bullet" && eo.type != "powerup") continue;
								eo.kill();
							}
							break;
						}
						case "testing6": {
							if (!devperms) break;
							for (let o = 0; o < entities.length; o++) {
								if (entities[o].lobby != e.lobby || entities[o].type == "tank") continue;
								entities[o].kill();
							}
							break;
						}
						default:
							console.log("invalid key")
							break;
					}
					break;
				}
				default: {
					console.log(`We just recieved an invalid request from user ${this.id}. Get the F#$% out of here hacker`);
					this.socket.kick("Invalid Key", "If you weren't hacking, report this bug and the cause to the developer please. If you want to try and rejoin, your server id was " + lobbies[this.lobby].id);
					break;
				}
			}
    }

		// when a socket closes, pop the player and all their children before removing them
    close(reason = "Maybe check your internet connection?") {
			let e = false;
			let lobby = null;
			for (let i of entities) 
				if (i.clientbound === this.id)
					if (e !== false) console.log("Uh Oh Spaghettio 2 things have the same client");
					else e = i;
			if (e && lobbies[e.lobby]) {
				lobby = e.lobby;
				if (e.host && lobbies[lobby].currentdata.players > 0) 
					for (let h of entities)
						if (h.lobby == e.lobby && h.clientbound && h != e) {
							h.host = true;
							break;
						}
				e.killNextCycle = true;
			}
      sockets.clients = sockets.clients.filter(socket => socket.id !== this.id);
      console.log(`Socket ${this.id} has disconnected. active sockets: ${sockets.clients.length}. Players in lobby: ${e.lobby}`);
			if (!e || lobby < 0 || lobby >= lobbies.length) return;
			if (lobbies[e.lobby].currentdata.players <= 0) {
				lobbies.splice(e.lobby, 1);
				for (let u of entities) if (u.lobby > e.lobby) u.lobby--;
				console.log(`lobby ${lobby} is closed`);
			}
    }

		// send data to a client
    talk(data) {
      if (this.socket.readyState === 1) this.socket.send(sockets.protocol.encode(data));
    }

		// if an error occurs let us know
    error(error) {
      throw error;
    }

		// when we don't like someone we can boot them
    kick(reason) {
      console.log("Socket %s has been kicked for %s", this.id, reason[0]);
			this.talk(["kick", reason[0], reason[1]]);
      this.socket.close();
    }
  },

	// when a client connects, make sure a bond is formed and then set them up with whatever they need
  connect(socket, request) {
    console.log("Socket %s has connected. Active sockets: %s", sockets.tally, sockets.clients.length + 1);
    sockets.clients.push(new sockets.class(socket, request));
  }
}

// create our web sockets and port
const site = ((port, connect) => {
  WebSocket(app);
  
  app.ws("/ws", connect);
  
  app.use(compression());
  app.use(minify());
  app.use(cors());
  app.use(express.static("public"));
  app.use(express.json());
  
  app.listen(port, () => console.log("Express is now active on port %s", port));
  return (directory, callback) => app.get(directory, callback);
})(port, sockets.connect);

app.use(express.static("public"));
app.get("", (req, res) => {
	res.sendFile(__dirname + "/public/index.html");
});