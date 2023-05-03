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