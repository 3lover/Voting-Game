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
const availableEmojis = 74;

const cards = require("./cards.json");

let lobbies = [];

class Lobby {
  constructor(id) {
    this.players = [];
    this.id = id;
    this.ingame = false;
    this.gamestage = 0;
    this.pointsystem = 3;
    this.decks = {
      main: true,
      dirty: false,
      custom: true,
      expansion1: true,
    }
    this.customcards = [];
    this.currentreview = 0;
    console.log(`lobby created with ID ${this.id}`)
  }
  
  matchId(match) {
    return (this.id === match);
  }
  
  send(data = []) {
    for (let p of this.players) p.talk(data);
  }
  
  sendhost() {
    for (let p = 0; p < this.players.length; p++) this.players[p].talk(["hoststatus", p === 0, this.gamestage]);
  }
  
  addPlayer(player) {
    for (let i = 0; i < 99; i++) {
      let retry = false;
      for (let p of this.players) if (p.name == player.name) {
        player.name += "*";
        retry = true;
        break;
      }
      if (!retry) break;
    }
    this.players.push(player);
    this.newicons();
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
  
  getCard() {
    let possibleCards = [];
    if (this.decks.main) possibleCards = possibleCards.concat(cards.main);
    if (this.decks.dirty) possibleCards = possibleCards.concat(cards.dirty);
    if (this.decks.expansion1) possibleCards = possibleCards.concat(cards.expansion1);
    if (this.decks.custom) possibleCards = possibleCards.concat(this.customcards);
    if (possibleCards.length < 1) return "No Decks Selected";
    return possibleCards[Math.floor(Math.random() * possibleCards.length)];
  }
  
  startRound() {
    this.send(["startingRound", this.getCard()]);
    for (let p of this.players) {
      p.vote = null;
      p.votes = 0;
      p.guesses = [];
    }
    this.ingame = true;
    this.gamestage = 0;
  }
  
  backInLobby() {
    this.send(["finalizeRound"]);
    this.ingame = false;
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
      let votersneeded = parseInt(p.votes);
      if (votersneeded == 0) continue;
      for (let v = 0; v < this.players.length; v++) {
        const voter = this.players[v];
        if (voter == p) continue;
        if (voter.vote == p && !p.guesses.includes(voter)) break;
        votersneeded--;
        if (votersneeded <= 0) {
          p.points++;
          break;
        }
      }
    }
    this.sendScores();
    
    this.currentreview = 0;
    this.sendReview();
  }
  
  sendScores() {
    let scores = new Array(this.players.length).fill(0);
    for (let p = 0; p < this.players.length; p++) scores[p] = this.players[p].points;
    this.send(["newscores", scores]);
  }
  
  sendReview() {
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
    this.send(["finalvotes", finalvotes, this.currentreview]);
  }
  
  findIcon(finder) {
    let availableIcons = [];
    for (let i = 0; i < availableEmojis; i++) availableIcons.push(i);
    for (let p of this.players) if (p != finder) availableIcons.splice(availableIcons.indexOf(p.icon), 1);
    return availableIcons[Math.floor(Math.random() * availableIcons.length)];
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
    this.icon = Math.floor(Math.random() * availableEmojis);
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
          let breaker = false;
          for (let l of lobbies) if (l.matchId(packet[0])) {
            this.talk(["failedjoin", 3]);
            breaker = true;
            break;
          }
          if (breaker) break;
          let p = new Player(this, packet[1], true);
          let lobby = new Lobby(packet[0]);
          lobbies.push(lobby);
          lobby.addPlayer(p);
          p.lobby = lobby;
          break;
        }
        case "join": {
          let lobby = false;
          for (let l of lobbies) if (l.id == packet[0]) {
            lobby = l;
            break;
          }
          if (!lobby) {
            this.talk(["failedjoin", 0]);
            break;
          }
          if (lobby.players.length >= availableEmojis) {
            this.talk(["failedjoin", 1]);
            break;
          }
          if (lobby.inlobby) {
            this.talk(["failedjoin", 2]);
            break;
          }
          
          let p = new Player(this, packet[1], false, lobby);
          lobby.addPlayer(p);
          p.icon = lobby.findIcon(p);
          break;
        }
        case "startgame": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.customcards = packet[0];
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
        case "refreshcard": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.startRound();
          player.lobby.send(["cardrefreshed", player.lobby.getCard()]);
          break;
        }
        case "customcards": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.customcards = packet[0];
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
          if (!valid) break;
          player.icon = packet[0];
          player.lobby.newicons();
          break;
        }
        case "changesetting": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          switch(packet[0]) {
            case "pointsystem": {
              player.lobby.pointsystem = parseInt(packet[1]);
              break;
            }
            case "maindeck": {
              player.lobby.decks.main = !!packet[1];
              break;
            }
            case "dirtydeck": {
              player.lobby.decks.dirty = !!packet[1];
              break;
            }
            case "expansion1deck": {
              player.lobby.decks.expansion1 = !!packet[1];
              break;
            }
            case "customdeck": {
              player.lobby.decks.custom = !!packet[1];
              break;
            }
          }
          break;
        }
        case "nextreview": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.currentreview++;
          if (player.lobby.players.length > player.lobby.currentreview) player.lobby.sendReview();
          else {
            player.lobby.gamestage = 0;
            player.lobby.backInLobby();
          }
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
    
    let hostrules = {
      pointsystem: l.pointsystem,
      maindeck: l.decks.main,
      dirtydeck: l.decks.dirty,
      expansion1deck: l.decks.expansion1,
      customdeck: l.decks.custom
    };
    
    let playernames = [];
    let playericons = [];
    for (let p of l.players) {
      playernames.push(p.name);
      playericons.push(p.icon);
    }
    
    l.sendScores();
    l.sendhost();
    l.send(["gameupdate", {
      players: playernames,
      icons: playericons,
      hostrules: hostrules,
    }]);
  }
}
setInterval(update, 200);