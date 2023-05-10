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
const availableEmojis = 15;

let lobbies = [];

class Lobby {
  constructor(host, id) {
    this.players = [host];
    this.id = this.validId(id);
    this.ingame = false;
    this.gamestage = 0;
    console.log(`lobby created with ID ${this.id}`)
  }
  
  validId(preferance) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let testedid = preferance;
    for (let i = 0; i < 999; i++) {
      for (let l of lobbies) if (l != this && l.id == testedid) {
	      testedid = "";
		    for (let i = 0; i < 4; i++) testedid += chars.charAt(Math.floor(Math.random() * chars.length));
        continue;
      }
    }
    return testedid;
  }
  
  send(data = []) {
    for (let p of this.players) p.talk(data);
  }
  
  sendhost() {
    for (let p = 0; p < this.players.length; p++) this.players[p].talk(["hoststatus", p === 0]);
  }
  
  addPlayer(player) {
    this.players.push(player);
  }
  
  checkfor(playersocket, removing) {
    for (let p of this.players) if (p.socket == playersocket) {
      if (removing) {
        this.players.splice(this.players.indexOf(p), 1);
        console.log(`player removed from lobby with id ${this.id}. ${this.players.length} players left`);
      }
      return p;
    }
    return -1;
  }
  
  matchname(name) {
    for (let p of this.players) if (p.name == name) {
      return p;
    }
    return -1;
  }
  
  startRound() {
    this.send(["startingRound"]);
    for (let p of this.players) {
      p.vote = null;
      p.votes = 0;
      p.guesses = [];
    }
    this.ingame = true;
    this.gamestage = 0;
  }
  
  checkvotes() {
    for (let p of this.players) {
      if (p.vote == null) return false;
    }
    return true;
  }
  
  tallyvotes() {
    for (let p of this.players) p.votes = 0;
    for (let p of this.players) p.vote.votes++;
    let votes = new Array(this.players.length).fill(0);
    for (let p = 0; p < this.players.length; p++) for (let v of this.players) if (this.players[p] == v.vote) votes[p]++;
    this.send(["votes", votes]);
  }
  
  checkguesses() {
    let totalGuesses = 0;
    for (let p of this.players) {
      totalGuesses += p.guesses.length;
    }
    return totalGuesses >= this.players.length;
  }
  
  newicons() {
    let icons = [];
    for (let p of this.players) icons.push(p.icon);
    for (let p of this.players) {
      p.talk(["newicons", icons, p.icon]);
    }
  }
  
  endRound() {
    for (let p of this.players) {
      for (let v = 0; v < this.players.length; v++) {
        const voter = this.players[v];
        if (voter == p) continue;
        if (voter.vote == p && !p.guesses.includes(voter)) break;
        if (v == this.players.length - 1) p.points++;
      }
    }
    let finalvotes = new Array(this.players.length).fill("");
    for (let i in finalvotes) finalvotes[i] = [];
    let scores = new Array(this.players.length).fill(0);
    for (let p = 0; p < this.players; p++) scores[p] = this.players[p].points;
    
    for (let p = 0; p < this.players.length; p++) {
      for (let v = 0; v < this.players.length; v++) {
        if (this.players[p] == this.players[v].vote) {
          finalvotes[p].push(v);
        }
      }
    }
    this.send(["finalvotes", finalvotes, scores]);
  }
}

class Player {
  constructor(socket, name, host, lobby) {
    this.socket = socket;
    this.name = name;
    this.color = 0;
    this.points = 0;
    this.lobby = lobby;
    this.host = host;
    this.vote = null;
    this.votes = 0;
    this.guesses = [];
    this.points = 0;
    this.icon = Math.floor(Math.random() * 15);
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
          let p = new Player(this, packet[1], true);
          lobbies.push(new Lobby(p, packet[0]));
          p.lobby = lobbies[lobbies.length - 1];
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
          
          let p = new Player(this, packet[1], false, lobby);
          lobby.addPlayer(p);
          break;
        }
        case "startgame": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.startRound();
          
          break;
        }
        case "vote": {
          let lobby = false;
          let voter = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) {
            lobby = l;
            voter = l.checkfor(this);
          }
          if (!lobby) break;
          
          let voted = lobby.matchname(packet[0]);
          if (voted == -1) break;
          
          if (voter.vote != null) break;
          if (voter == voted) break;
          voter.vote = voted;
          
          this.talk(["voted", packet[0]]);
          
          break;
        }
        case "guessvoter": {
          let lobby = false;
          let guesser = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) {
            lobby = l;
            guesser = l.checkfor(this);
          }
          if (!lobby) break;
          
          let guessed = lobby.matchname(packet[0]);
          if (guessed == -1) break;
          
          if (guesser === guessed) break;
          if (guesser.guesses.length >= guesser.votes) break;
          guesser.guesses.push(guessed);
          
          this.talk(["guessed", packet[0]]);
          
          break;
        }
        case "switchicon": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          
          let valid = true;
          for (let p of player.lobby.players) {
            if (p == player) continue;
            if (p.icon == packet[0]) valid = false;
            
            if (!valid) break;
          }
          console.log("validating")
          if (!valid) break;
          player.icon = packet[0];
          console.log("icon selected");
          player.lobby.newicons();
          break;
        }
      }
    }

		// when a socket closes, pop the player and all their children before removing them
    close(reason = "Maybe check your internet connection?") {
      for (let l of lobbies) l.checkfor(this, true);
      for (let l = lobbies.length - 1; l >= 0; l--) if (lobbies[l].players.length < 1) lobbies.splice(l, 1);
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
  for (let l = lobbies.length - 1; l >= 0; l--) if (lobbies[l].players.length < 1) lobbies.splice(l, 1);
  
  for (let l of lobbies) {
    if (l.ingame && l.gamestage === 0 && l.checkvotes()) {
      l.gamestage = 1;
      l.tallyvotes();
    }
    if (l.ingame && l.gamestage === 1 && l.checkguesses()) {
      l.gamestage = 2;
      l.endRound();
    }
    if (l.gamestage === 2) {
      l.gamestage = -1;
      setTimeout(() => {
        l.gamestage = 0;
        l.startRound();
      }, 10000);
    }
    
    l.newicons();
    
    let playernames = [];
    let playericons = [];
    for (let p of l.players) {
      playernames.push(p.name);
      playericons.push(p.icon);
    }
    
    l.sendhost()
    l.send(["gameupdate", {
      players: playernames,
      icons: playericons
    }]);
  }
}
setInterval(update, 200);