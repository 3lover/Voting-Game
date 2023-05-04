// initialize our dependancies
const express = require('express');
const minify = require("express-minify");
const cors = require("cors");
const WebSocket = require("express-ws");
const web = express();
const compression = require("compression");
const app = express();
const http = require('http');
const server = http.createServer();
const port = 3000;

let lobbies = [];

class Lobby {
  constructor(host, id) {
    this.players = [host];
    this.id = this.validId(id);
  }
  
  validId(preferance) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-+"; //base64
    let testedid = preferance;
    for (let i = 0; i < 999; i++) {
      for (let l of lobbies) if (l != this && l.id == testedid) {
	      testedid = "";
		    for (let i = 0; i < 4; i++) testedid += chars.charAt(Math.floor(Math.random() * chars.length));
        continue;
      }
    }
  }
  
  send(data = []) {
    for (let p of this.players) p.talk(data);
  }
  
  addPlayer(player) {
    this.players.push(player);
  }
}

class Player {
  constructor(socket, name) {
    this.socket = socket;
    this.name = name;
    this.color = 0;
    this.points = 0;
  }
  
  talk(data = []) {
    this.socket.talk(data);
  }
}

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
        case "log": {
          for (let i of packet) {
            let time = new Date()
            console.log(`[${i[0]}][${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}][${typeof i[1]}]: ${JSON.stringify(i[1])}`)
          }
        }
        case "connectionCheck": {
          this.talk(["connectionConfirmed"]);
					break;
        }
        case "host": {
          let p = new Player(this, packet[1]);
          lobbies.push(new Lobby(p, packet[0]));
          break;
        }
        case "join": {
          let lobby = false;
          for (let l of lobbies) if (l.id == packet[0]) {
            lobby = l;
            break;
          }
          if (!lobby) {
            this.talk(["failedjoin"]);
            console.log(`player tried to join ${packet[0]} but it does not exist`);
            return;
          }
          
          let p = new Player(this, packet[1]);
          lobby.addPlayer(p);
          break;
        }
      }
    }

		// when a socket closes, pop the player and all their children before removing them
    close(reason = "Maybe check your internet connection?") {
      
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

//go through our lobbies
function update() {
  for (let l of lobbies) {
    let playernames = [];
    for (let p of l.players) playernames.push(p.name);
    
    l.send(["gameupdate", {
      players: playernames
    }])
  }
}
setInterval(update, 200);