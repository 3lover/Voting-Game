const elm = {};

// dropdown menu
let settingbarDropped = false;
elm.settingbar = document.getElementById("settingbar");
elm.settingbardropdown = document.getElementById("settingbardropdown");
elm.settingbardropdown.addEventListener("click", (e) => {
  if (settingbarDropped) elm.settingbar.style.top = "-40vh";
  else elm.settingbar.style.top = "0vh";
  settingbarDropped = !settingbarDropped;
});

// load color pallets
let colors = "not ready";
async function getcolors() {
	colors = await (await fetch("./json/colors.json")).json();
}
getcolors();

// color scheme settings
elm.root = document.querySelector(':root')
function remakeColors(scheme) {
  if (colors === "not ready") {
    setTimeout(() => {remakeColors(scheme)}, 1000);
    return;
  }
  for (let k in Object.keys(colors[scheme])) {
    elm.root.style.setProperty(Object.keys(colors[scheme])[k], Object.values(colors[scheme])[k]);
  }
}
elm.adjustColor = document.getElementById("adjustcolor");
elm.adjustColor.value = localStorage.getItem("adjustcolor") ?? "light";
remakeColors(elm.adjustColor.value);
elm.adjustColor.addEventListener("change", (e) => {
  localStorage.setItem("adjustcolor", e.target.value);
  remakeColors(e.target.value);
});

// page transitions
let noTransitions = localStorage.getItem("pagetransitions") == "true" ?? false;
elm.pageTransitions = document.getElementById("pagetransitions");
elm.pageTransitions.value = noTransitions ? "0" : "1";
elm.pageTransitions.addEventListener("change", () => {
  noTransitions = !noTransitions;
  localStorage.setItem("pagetransitions", noTransitions ? "true" : "false");
});

// page transitions
elm.leftSlide = document.getElementById("lefttransitionpanel");
elm.rightSlide = document.getElementById("righttransitionpanel")
function swapPages(open = "id", close = "id") {
  elm.settingbar.style.top = "-40vh";
  settingbarDropped = false;
  
  if (noTransitions) {
    elm.leftSlide.style.transition = "0";
    elm.rightSlide.style.transition = "0";
    document.getElementById(open).style.display = "block";
    document.getElementById(close).style.display = "none";
    return;
  }
  
  elm.leftSlide.style.transition = "0.5s";
  elm.rightSlide.style.transition = "0.5s";
  elm.leftSlide.style.left = "0";
  elm.rightSlide.style.left = "50vw";
  
  setTimeout(() => {
    document.getElementById(open).style.display = "block";
    document.getElementById(close).style.display = "none";
    elm.leftSlide.style.left = "-60vw";
    elm.rightSlide.style.left = "110vw";
  }, 1000);
}

// lobby hosting
elm.hostButton = document.getElementById("hostbutton");
elm.hostButton.addEventListener("click", () => {
  swapPages("hostinfopage", "frontpage");
});

// lobby joining
elm.joinButton = document.getElementById("joinbutton");
elm.joinButton.addEventListener("click", () => {
  swapPages("typenamepage", "frontpage");
});

// lobby finding
let waitingForLobby = false;
elm.findButton = document.getElementById("findbutton");
elm.findButton.addEventListener("click", () => {
  waitingForLobby = true;
  swapPages("waitingpage", "frontpage");
});

// find page x button
elm.spinXButton = document.getElementById("spinx");
elm.spinXButton.addEventListener("click", () => {
  waitingForLobby = false;
  swapPages("frontpage", "waitingpage");
});

// type name page x button
elm.typeXButton = document.getElementById("typex");
elm.typeXButton.addEventListener("click", () => {
  swapPages("frontpage", "typenamepage");
});

// host info page x button
elm.hostXButton = document.getElementById("hostinfox");
elm.hostXButton.addEventListener("click", () => {
  swapPages("frontpage", "hostinfopage");
});

// our websocket
class Socket {
	constructor() {
		this.socket = new WebSocket("wss://votegame.glitch.me/ws");
		this.socket.binaryType = "arraybuffer";
		this.protocol = (() => {
			const encoder = new TextEncoder().encode.bind(new TextEncoder());
			const decoder = new TextDecoder().decode.bind(new TextDecoder());
			return {
				encode: (message) => encoder(JSON.stringify(message)).buffer,
				decode: (message) => JSON.parse(decoder(message.data)),
			};
		})();

		this.socket.onopen = () => this.open();
		this.socket.onmessage = (data) => this.message(data);
		this.socket.onerror = (error) => this.error(error);
		this.socket.onclose = (reason) => this.close(reason);
    
    this.connected = true;
	}
  
  checkSocketStatus(pingtime, intervalsleft, callbackpositive, callbacknegative, first = true) {
    if (first) {
      this.connected = false;
      this.talk(["connectionCheck"]);
    }
    if (this.connected) {
      callbackpositive();
      return;
    }
    if (intervalsleft <= 0) {
      callbacknegative();
      return;
    }
    setTimeout(() => {this.checkSocketStatus(pingtime, intervalsleft - 1, callbackpositive, callbacknegative, false)}, pingtime);
  }

	// send whatever data we need to send, as well as request from the server
	talk(data) {
		if (this.socket.readyState !== 1) return;
		data = this.protocol.encode(data);
		this.socket.send(data);
	}

	// whenever we recieve a packet, identify the type and then treat it appropriately 
	message(packet) {
		packet = this.protocol.decode(packet);
		switch (packet.shift()) {
      case "connectionConfirmed": {
        this.connected = true;
      }
      case "gameupdate": {
        
        break;
      }
		}
	}

	// whenever we open a socket log it
	open() {
		console.log("Socket connected");
	}

	// whenever we get an error log it
	error(error) {
		console.error(error);
	}

	// whenever we get our socket closed for any reason, make sure we log it
	close(reason) {
		console.log("Socket closed");
		console.log(reason);
	}
}
let socket = new Socket();

// attempt to host lobby
elm.hostGameID = document.getElementById("hostgameid");
elm.hostGameNickname =  document.getElementById("hostgamenickname");
elm.attemptHost = document.getElementById("attempthost");
elm.attemptHost.addEventListener("click", () => {
  socket.checkSocketStatus(200, 20, () => {
    socket.talk(["host", elm.hostGameID.value, elm.hostGameNickname.value])
    swapPages("gamepage", "typenamepage");
  }, () => {
    //swapPages("gamepage", "typenamepage");
  });
});

// add the name icons when in lobby
elm.gamePageNameBox = document.getElementById("gamepagenamebox");
function createNames(names = []) {
  let child = elm.gamePageNameBox.lastElementChild; 
  while (child) {
    elm.gamePageNameBox.removeChild(child);
    child = elm.gamePageNameBox.lastElementChild;
  }
  for (let n of names) {
		const box = document.createElement("div");
    box.classList.add("nameicon");
    const text = document.createTextNode(n);

		box.appendChild(text);

		elm.gamePageNameBox.appendChild(box);
  }
}