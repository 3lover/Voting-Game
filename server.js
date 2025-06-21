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
const availableEmojis = 161;


const allWords = require("./words.json");
const idlength = 2;
function ranID() {
  while (1) {
    let id = "";
    for (let i = 0; i < idlength; i++) {
      id += allWords[Math.floor(allWords.length * Math.random())];
      if (i + 1 < idlength) id += " ";
    }
    return id;
  }
}

let lobbies = [];

class Lobby {
  constructor(id) {
    this.players = [];
    this.name = "";
    this.id = id;
    this.ingame = false;
    this.gamestage = 0;
    this.pointsystem = 2;
    this.customcards = [];
    this.currentreview = 0;
    this.customvisibility = 0;
    this.public = false;
    this.cardMethod = 0;
    this.updateStatuses = false;
    this.remakePlates = false;
    this.typingPlayer = null;
    this.typingTurn = 0;
    this.banlist = [];
    this.logs = [];
    this.maxPlayers = 8;
    this.currentCardLocation = 0;
    this.waitingList = [];
    this.pwetty = Math.random() > 0.99;
    console.log(`lobby created with ID ${this.id}`);
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
  
  sendme() {
    for (let p = 0; p < this.players.length; p++) this.players[p].talk(["sendme", p]);
  }
  
  addPlayer(player) {
    this.players.push(player);
    this.newicons();
  }
  
  checkfor(playersocket, removing) {
    for (let p of this.players) if (p.socket == playersocket) {
      if (removing) {
        // deal with lobby conflict from people leaving by reseting the votes of everyone
        if (this.ingame && this.gamestage === 0) {
          for (let i = 0; i < this.players.length; i++) this.players[i].vote = null;
        }
        if (this.ingame && this.gamestage == 1) {
          p.vote.votes--;
          for (let i = 0; i < this.players.length; i++) this.players[i].guesses = [];
        }
        
        if (p.host && this.players.length > 1) this.players[1].host = true;
        this.players.splice(this.players.indexOf(p), 1);
        console.log(`player removed from lobby with id ${this.id}. ${this.players.length} players left`);
        this.logs.push({
          text: p.name + " left the game",
          color: "var(--backred)"
        });
        this.send(["newlog", this.logs]);
        
        if (this.ingame) this.updateStatuses = true;
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
  
  getCard(cardMethod) {
    if (this.customcards.length < 1) return "The host forgot to enable a deck. Your new prompt is who is most likely to have not made this blunder, had they been hosting?";
    switch (cardMethod) {
      case 0: {
        // choose a deck then choose a card
        let deck = Math.floor(Math.random() * this.customcards.length);
        
        if (this.customcards[deck].cards.length < 1) return this.customcards[deck].name + " was the deck selected, but the host left it empty. Your new prompt is who is most likely to have not made this blunder, had they been hosting?";
        let card = Math.floor(Math.random() * this.customcards[deck].cards.length);
        
        return this.customcards[deck].cards[card];
      }
      case 1: {
        // choose a card completely at random
        let cardChosen = 0;
        for (let i = 0; i < this.customcards.length; i++) cardChosen += this.customcards[i].cards.length;
        cardChosen = Math.floor(Math.random() * cardChosen);
        for (let i = 0; i < this.customcards.length; i++) {
          if (cardChosen < this.customcards[i].cards.length) return this.customcards[i].cards[cardChosen];
          cardChosen -= this.customcards[i].cards.length;
        }
        return "The host has some decks enabled, but they are all empty. Your new prompt is who is most likely to have not made this blunder, had they been hosting?";
      }
      case 4: {
        let cardChosen = 0;
        for (let i = 0; i < this.customcards.length; i++) cardChosen += this.customcards[i].cards.length;
        cardChosen = parseInt(this.currentCardLocation);
        this.currentCardLocation++;
        for (let i = 0; i < this.customcards.length; i++) {
          if (cardChosen < this.customcards[i].cards.length) return this.customcards[i].cards[cardChosen];
          cardChosen -= this.customcards[i].cards.length;
        }
        this.currentCardLocation = 0;
        return "You have no cards left to go through! Your current card has been reset to the first card.";
      }
    }
  }
  
  startRound() {
    if (this.players.length < 2) return;
    for (let p of this.players) {
      p.vote = null;
      p.votes = 0;
      p.guesses = [];
    }
    this.ingame = true;
    this.gamestage = 0;
    if (this.cardMethod === 2 || this.cardMethod === 3 || this.cardMethod === 5) {
      if (this.typingTurn >= this.players.length) this.typingTurn = 0;
      this.typingPlayer = this.players[this.cardMethod === 3 ? 0 : this.cardMethod === 5 ? Math.floor(this.players.length * Math.random()) : this.typingTurn];
      for (let p of this.players) {
        if (p === this.typingPlayer) continue;
        let placeholderText = "Bored? Here's 10 random words to inspire your next card:\n\n- ";
        for (let i = 0; i < 10; i++) placeholderText += allWords[Math.floor(Math.random() * allWords.length)] + (i === 9 ? "" : "\n- ");
          p.talk(["typingcard", this.typingPlayer.name, placeholderText]);
        }
      this.typingPlayer.talk(["starttyping"]);
      this.gamestage = 3;
      this.typingTurn++;
    }
    else this.send(["startingRound", this.getCard(this.cardMethod)]);
  }
  
  generateIdeas() {
    let placeholderText = "- ";
    for (let i = 0; i < 100; i++) placeholderText += allWords[Math.floor(Math.random() * allWords.length)] + (i === 99 ? "" : "\n- ");
    this.typingPlayer.talk(["ideasGenerated", "Here are 100 random English words to inspire you:\n" + placeholderText]);
  }
  
  backInLobby() {
    this.send(["finalizeRound"]);
    this.ingame = false;
    for (let i of this.waitingList) i.talk(["tryRejoining", this.id]);
    this.waitingList = [];
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
    let allDone = true;
    for (let p of this.players) {
      if (p.guesses.length === p.votes) continue
      allDone = false;
      break;
    }
    return allDone;
  }
  
  newicons() {
    let icons = [];
    let colors = [];
    for (let p of this.players) {
      icons.push(p.icon);
      colors.push(p.color);
    }
    for (let p of this.players) {
      p.talk(["newicons", icons, p.icon, colors]);
    }
  }
  
  endRound() {
    if (this.pointsystem === 2 || this.pointsystem === 3) {
      for (let p of this.players) {
        let pointcounter = 0;
        let votersneeded = parseInt(p.votes);
        if (votersneeded == 0) continue;
        for (let v = 0; v < this.players.length; v++) {
          const voter = this.players[v];
          if (voter == p) continue;
          if (voter.vote != p) continue;
          if (voter.vote == p && !p.guesses.includes(voter)) continue;
          votersneeded--;
          if (this.pointsystem === 2) {
            pointcounter++;
            p.points++;
          }
          if (votersneeded <= 0 && this.pointsystem === 3) {
            this.logs.push({
              text: p.name + " scored a point by guessing all their voters correctly",
              color: "var(--text)"
            });
            this.send(["newlog", this.logs]);
            p.points++;
            break;
          }
        }
        if (this.pointsystem === 2) {
          this.logs.push({
              text: p.name + " got " + pointcounter + " correct guess" + (pointcounter === 1 ? "" : "es"),
              color: "var(--text)"
          });
          this.send(["newlog", this.logs]);
        }
      }
    }
    else if (this.pointsystem === 1) {
      let mostvoted = [this.players[0]];
      for (let p of this.players) {
        if (p == this.players[0]) continue;
        if (p.votes > mostvoted[0].votes) mostvoted = [p];
        else if (p.votes == mostvoted[0].votes) mostvoted.push(p);
      }
      for (let p of mostvoted) {
        this.logs.push({
              text: p.name + " scored a point by getting the most votes",
              color: "var(--text)"
        });
        this.send(["newlog", this.logs]);
        p.points++;
      }
    }
    this.sendScores();
    
    this.currentreview = 0;
    for (let p of this.players) 
      if (p.votes <= 0) this.currentreview++;
      else break;
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
  
  getHost() {
    for (let p of this.players) if (p.host) return p;
    console.log("lobby is missing a host!");
    return null;
  }
}

class Player {
  constructor(socket, name, host, lobby, clientID) {
    this.socket = socket;
    this.name = name;
    this.color = "#ff0000";
    this.points = 0;
    this.lobby = lobby;
    this.host = host;
    this.vote = null;
    this.votes = 0;
    this.guesses = [];
    this.points = 0;
    this.clientID = clientID;
    this.icon = Math.floor(Math.random() * availableEmojis);
  }
  
  talk(data = []) {
    this.socket.talk(data);
  }
}

function requestListener(req, res) {
  //let forwarded = req.headers['x-forwarded-for']
  let ip = req.socket.remoteAddress;
  //res.writeHead(200);
  //res.end(ip);
  console.log(ip);
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
      // validate the packet to 'try' and avoid issues
      try {
        packet = sockets.protocol.decode(packet);
        if (typeof packet !== "object") {
          console.log("A non-array Packet was sent to us, we are ignoring it.");
          return;
        }
        if (packet[0] === undefined) {
          console.log(packet);
          console.log("The packet sent to us is empty, and has no type, we are ignoring it.");
          return;
        }
      } catch (error) {
        console.log("Packet recieved from a shady client, we got this error reading it:\n" + error);
      }
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
        case "updateColor": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          
          player.color = packet[0];
          player.lobby.newicons();
          break;
        }
        case "generateIdeas": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          
          player.lobby.generateIdeas();
          break;
        }
        case "getLobbyList": {
          let senddata = [];
          for (let l of lobbies) {
            if (!l.public) continue;
            if (l.ingame) continue;
            senddata.push({
              name: l.name,
              players: l.players.length,
              maxplayers: l.maxPlayers,
              id: l.id
            });
          }
          this.talk(["sentLobbyList", senddata]);
          break;
        }
        case "banPlayer": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          if (packet[0] === 0) break;
          
          let bannedPlayer = player.lobby.players[packet[0]];
          player.lobby.banlist.push(bannedPlayer.clientID);
          bannedPlayer.socket.talk(["failedjoin", 4]);
          bannedPlayer.socket.kick();
          player.lobby.checkfor(bannedPlayer.socket, true);
          player.lobby.logs.push({
            text: "The host banned " + bannedPlayer.name,
            color: "var(--backred)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "overridePlayerScore": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          if (isNaN(parseFloat(packet[1]))) break;
          
          let rescoredPlayer = player.lobby.players[packet[0]];
          rescoredPlayer.points = parseFloat(packet[1]);
          player.lobby.remakePlates = true;
          
          player.lobby.logs.push({
            text: player.name + " had their score overrided to " + rescoredPlayer.points,
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "renamePlayer": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          let renamedPlayer = player.lobby.players[packet[0]];
          renamedPlayer.name = String(packet[1]);
          player.lobby.remakePlates = true;
          
          player.lobby.logs.push({
            text: player.name + " had their name overrided to " + renamedPlayer.name,
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "kickPlayer": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          if (packet[0] === 0) break;
          
          let kickedPlayer = player.lobby.players[packet[0]];
          kickedPlayer.socket.talk(["failedjoin", 6]);
          kickedPlayer.socket.kick();
          player.lobby.checkfor(kickedPlayer.socket, true);
          
          player.lobby.logs.push({
            text: "The host kicked " + kickedPlayer.name,
            color: "var(--backred)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "transferHost": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          if (packet[0] === 0) break;
          
          let newHost = player.lobby.players[packet[0]];
          newHost.host = true;
          player.host = false;
          player.lobby.players.splice(packet[0], 1);
          player.lobby.players.unshift(newHost);
          player.lobby.remakePlates = true;
          
          player.lobby.logs.push({
            text: "Host privileges have been transfered to " + newHost.name,
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "changeLobbyId": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          let breaker = false;
          console.log(packet[0]);
          for (let l of lobbies) if (l.matchId(packet[0])) {
            this.talk(["cannotChangeId"]);
            breaker = true;
            break;
          }
          if (breaker) break;
          
          console.log("lobby code changed from " + player.lobby.id + " to " + packet[0]);
          player.lobby.id = packet[0];
          
          player.lobby.logs.push({
            text: "The lobby Join Code was changed by the host",
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "changeLobbyName": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          if (packet[0].length > 28) packet[0] = packet[0].substring(0, 28);
          
          player.lobby.name = packet[0];
          
          player.lobby.logs.push({
            text: "The lobby name was changed by the host",
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "eraseBanList": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.banlist = [];
          
          player.lobby.logs.push({
            text: "The lobby's ban list was erased by the host",
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
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
          lobby.name = p.name + "'s Lobby";
          lobby.customcards = packet[2];
          lobby.pointsystem = parseInt(packet[3].pointsystem) ?? 2;
          lobby.customvisibility = parseInt(packet[3].customvisibility) ?? 0;
          lobby.cardMethod = parseInt(packet[3].cardselectsystem) ?? 0;
          lobby.maxPlayers = parseInt(packet[3].maxplayers) ?? 8;
          p.color = String(packet[3].color) ?? "#ff0000";
          lobby.logs.push({
            text: "The lobby has been hosted by " + p.name,
            color: "var(--green)"
          });
          lobby.send(["newlog", lobby.logs]);
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
          if (lobby.players.length >= lobby.maxPlayers) {
            this.talk(["failedjoin", 1]);
            break;
          }
          if (lobby.ingame) {
            this.talk(["failedjoin", 2]);
            lobby.waitingList.push(this);
            break;
          }
          if (lobby.banlist.includes(packet[2])) {
            this.talk(["failedjoin", 4]);
            break;
          }
          if (!packet[2] || packet[2].length != 11 || packet[2][0] != "#") {
            this.talk(["failedjoin", 5]);
            break;
          }
          
          let p = new Player(this, packet[1], false, lobby, packet[2]);
          lobby.addPlayer(p);
          p.icon = lobby.findIcon(p);
          p.color = packet[3] ?? "#ff0000";
          
          lobby.remakePlates = true;
          lobby.logs.push({
            text: "A new player has joined by the name of " + p.name,
            color: "var(--green)"
          });
          lobby.send(["newlog", lobby.logs]);
          lobby.send(["pwettychange", lobby.pwetty]);
          
          if (!lobby.customvisibility) {
                this.talk(["hostedCards", [], []]);
                break;
          }
          let decknames = [];
          let deckcontents = [];
          for (let i of lobby.customcards) {
            decknames.push(i.name);
            deckcontents.push(i.cards);
          }
          this.talk(["hostedCards", decknames, deckcontents]);
          break;
        }
        case "refreshcard": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.startRound();
          player.lobby.send(["cardrefreshed"]);
          break;
        }
        case "backToLobby": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.backInLobby();
          break;
        }
        case "submitTyped": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (player.lobby.typingPlayer != player) break;
          
          if (packet[0].length > 0) player.lobby.typedCard = packet[0];
          else {
            player.talk(["cardSentToTyper", player.lobby.getCard(1)]);
            return;
          }
          
          player.lobby.send(["typingDone", player.lobby.typedCard]);
          player.lobby.gamestage = 0;
          
          player.lobby.logs.push({
            text: player.name + " wrote:\n" + packet[0],
            color: "var(--text)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "updateHostedCards": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.customcards = packet[0];
          if (!player.lobby.customvisibility) {
            player.lobby.send(["hostedCards", [], []]);
            break;
          }
          let decknames = [];
          let deckcontents = [];
          for (let i of player.lobby.customcards) {
            decknames.push(i.name);
            deckcontents.push(i.cards);
          }
          player.lobby.send(["hostedCards", decknames, deckcontents]);
          break;
        }
        case "startgame": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.startRound();
          
          if (player.lobby.players.length <= 1) break;
          
          player.lobby.logs.push({
            text: "The host started a new game",
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
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
          
          if (lobby.gamestage !== 0) return;
          
          let voted = parseInt(packet[0]);
          if (isNaN(voted) || voted == -1) break;
          voted = voter.lobby.players[voted];
          
          if (voter.vote !== voted && voter.vote != null) break;
          if (voter == voted) break;
          
          if (voter.vote === voted) {
            voter.vote = null;
            this.talk(["unvoted", packet[0]]);
          }
          else {
            voter.vote = voted;
            this.talk(["voted", packet[0]]);
          }
          
          let voters = [];
          for (let i = 0; i < lobby.players.length; i++) if (lobby.players[i].vote !== null) voters.push(i);
          lobby.send(["showVotingStatus", voters]);
          
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
          
          if (lobby.gamestage !== 1) return;
          
          let guessed = parseInt(packet[0]);
          if (isNaN(guessed) || guessed == -1) break;
          guessed = guesser.lobby.players[guessed];
          
          if (guesser === guessed) break;
          if (!guesser.guesses.includes(guessed) && guesser.guesses.length >= guesser.votes) break;
          
          if (guesser.guesses.includes(guessed)) {
            guesser.guesses.splice(guesser.guesses.indexOf(guessed), 1);
            this.talk(["unguessed", packet[0]]);
          } else {
            guesser.guesses.push(guessed);
            this.talk(["guessed", packet[0]]);
          }
          
          let voters = [];
          for (let i = 0; i < lobby.players.length; i++) if (lobby.players[i].guesses.length >= lobby.players[i].votes) voters.push(i);
          lobby.send(["showVotingStatus", voters]);
          
          break;
        }
        case "switchicon": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          
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
            case "customvisibility": {
              player.lobby.customvisibility = parseInt(packet[1]);
              if (!player.lobby.customvisibility) {
                player.lobby.send(["hostedCards", [], []]);
                break;
              }
              let decknames = [];
              let deckcontents = [];
              for (let i of player.lobby.customcards) {
                decknames.push(i.name);
                deckcontents.push(i.cards);
              }
              player.lobby.send(["hostedCards", decknames, deckcontents]);
              break;
            }
            case "cardselectsystem": {
              player.lobby.cardMethod = parseInt(packet[1]);
              break;
            }
            case "maxplayers": {
              if (isNaN(parseInt(packet[1]))) break;
              player.lobby.maxPlayers = parseInt(packet[1]);
              break;
            }
            case "pwetty": {
              player.lobby.pwetty = packet[1] === "1";
              player.lobby.send(["pwettychange", player.lobby.pwetty]);
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
          
          for (let i = 0; i < 99; i++) {
            player.lobby.currentreview++;
            if (player.lobby.players.length <= player.lobby.currentreview) break;
            if (player.lobby.players[player.lobby.currentreview].votes <= 0) continue;
            break;
          }
          if (player.lobby.players.length > player.lobby.currentreview) {
            player.lobby.sendReview();
          }
          else {
            player.lobby.gamestage = 0;
            player.lobby.backInLobby();
          }
          break;
        }
        case "publicitychange": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          if (!player.host) break;
          
          player.lobby.public = !player.lobby.public;
          
          player.lobby.logs.push({
            text: "The lobby was made " + (player.lobby.public ? "Public" : "Private") + " by the host",
            color: "var(--green)"
          });
          player.lobby.send(["newlog", player.lobby.logs]);
          break;
        }
        case "leaveGame": {
          let player = false;
          for (let l of lobbies) if (l.checkfor(this) !== -1) player = l.checkfor(this);
          if (!player) break;
          
          for (let l of lobbies) l.checkfor(this, true);
          for (let l = lobbies.length - 1; l >= 0; l--) if (lobbies[l].players.length < 1) {
            lobbies.splice(l, 1);
            console.log("lobby removed");
          }
          break;
        }
        default: {
          console.log("strange request recieved");
          break;
        }
      }
    }

		// when a socket closes, pop the player and all their children before removing them
    close(reason = "Maybe check your internet connection?") {
      for (let l of lobbies) l.checkfor(this, true);
      for (let l = lobbies.length - 1; l >= 0; l--) if (lobbies[l].players.length < 1) {
        lobbies.splice(l, 1);
        console.log("lobby removed");
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
app.get("/", (req, res) => {
	res.sendFile(__dirname + "/public/index.html");
});

//go through our lobbies
function update() {
  for (let l = lobbies.length - 1; l >= 0; l--) if (lobbies[l].players.length < 1) {
    lobbies.splice(l, 1);
    console.log("lobby removed");
  }
  
  for (let l of lobbies) {
    if (l.ingame && l.gamestage === 0 && l.checkvotes()) {
      l.gamestage = 1;
      l.tallyvotes();
      let voters = [];
      for (let i = 0; i < l.players.length; i++) if (l.players[i].votes === 0) voters.push(i);
      l.send(["showVotingStatus", voters]);
    }
    if (l.ingame && l.gamestage === 1 && l.checkguesses()) {
      l.gamestage = 2;
      l.endRound();
    }
    
    l.maxPlayers = Math.min(Math.max(Math.max(2, l.players.length), l.maxPlayers), 100);
    
    let hostrules = {
      pointsystem: l.pointsystem,
      customvisibility: l.customvisibility,
      cardselectsystem: l.cardMethod,
      maxplayers: l.maxPlayers,
      pwetty: l.pwetty ? 1 : 0
    };
    
    let playernames = [];
    let playericons = [];
    let playercolors = [];
    for (let p of l.players) {
      playernames.push(p.name);
      playericons.push(p.icon);
      playercolors.push(p.color);
    }
    
    l.sendScores();
    l.sendhost();
    l.sendme();
    l.send(["gameupdate", {
      players: playernames,
      icons: playericons,
      colors: playercolors,
      hostrules: hostrules,
      lobbyname: l.name,
      lobbypublicity: l.public,
      pwetty: l.pwetty
    }, l.remakePlates]);
    l.remakePlates = false;
    
    if (l.updateStatuses) {
      let voters = [];
      
      if (l.gamestage === 0) {
        for (let i = 0; i < l.players.length; i++) if (l.players[i].vote !== null) voters.push(i);
      }
      
      
      if (l.gamestage === 1) {
        l.tallyvotes();
        for (let i = 0; i < l.players.length; i++) if (l.players[i].guesses.length >= l.players[i].votes) voters.push(i);
      }
      
      
      if (l.gamestage == 2) {
        l.currentreview = 0;
        for (let p of l.players) 
          if (p.votes <= 0) l.currentreview++;
          else break;
        l.sendReview();
      }
      
      l.send(["showVotingStatus", voters]);
      
      if (l.players.length < 2) l.backInLobby();
      l.updateStatuses = false;
    }
  }
}
setInterval(update, 200);