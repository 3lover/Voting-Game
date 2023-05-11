const serverdata = {
  players: [],
  icons: [],
  myicon: 0,
  host: true,
  votes: [],
  scores: []
}
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

// load icons
let emojiIcons = "not ready";
async function geticons() {
	emojiIcons = Object.values(await (await fetch("./json/emojis.json")).json());
}
geticons();

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
let currentpage = "frontpage";
elm.leftSlide = document.getElementById("lefttransitionpanel");
elm.rightSlide = document.getElementById("righttransitionpanel");
function swapPages(open = "id", close = "id") {
  currentpage = open;
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

// when a game page tab is clicked, color it in and view the content
elm.GPTsetting = document.getElementById("GPTsetting");
elm.GPTcards = document.getElementById("GPTcards");
elm.GPTemoji = document.getElementById("GPTemoji");
elm.GPTchat = document.getElementById("GPTchat");
const GPTs = [elm.GPTsetting, elm.GPTcards, elm.GPTemoji, elm.GPTchat];
elm.settingtabcontent = document.getElementById("settingtabcontent");
elm.cardstabcontent = document.getElementById("cardstabcontent");
elm.emojitabcontent = document.getElementById("emojitabcontent");
elm.chattabcontent = document.getElementById("chattabcontent");
const contents = [elm.settingtabcontent, elm.cardstabcontent, elm.emojitabcontent, elm.chattabcontent];

function highlightGPT(tab) {
  for (let i = 0; i < GPTs.length; i++) {
    if (GPTs[i] === tab) {
      GPTs[i].style.backgroundColor = "var(--backred)";
      contents[i].style.display = "block";
    }
    else {
      GPTs[i].style.backgroundColor = "var(--background)";
      contents[i].style.display = "none";
    }
  }
}
for (let i of GPTs) {
  i.addEventListener("click", () => {
    highlightGPT(i);
  });
}

// when a setting is changed, alert the server\
function settingchanged(id, value) {
  socket.talk(["changesetting", id, value]);
}
const settingids = [
  ["pointsystem", "select"],
  ["maindeck", "checkbox", "maindeckmark"],
  ["dirtydeck", "checkbox", "dirtydeckmark"],
  ["expansiondeck", "checkbox", "expansiondeckmark"],
  ["leastdeck", "checkbox", "leastdeckmark"]
];
for (let i of settingids) {
  document.getElementById(i[0]).addEventListener(i[1] == "select" ? "change" : "click", (e) => {
    settingchanged(i[0], i[1] == "checkbox" ? e.target.checked : e.target.value);
  });
}
function adjustsettings(newvalues = {}) {
  for (let i of settingids) {
    let currentelement = document.getElementById(i[0]);
    if (i[1] == "select") currentelement.value = newvalues[i[0]];
    else if (i[1] == "checkbox") {
      currentelement.checked = newvalues[i[0]];
      if (currentelement.checked) document.getElementById(i[2]).style.backgroundColor = "var(--backred)";
      else document.getElementById(i[2]).style.backgroundColor = "var(--background)";
    }
  }
}


// create the emoji tabs
function updateEmojis(emojis, myemoji) {
  let child = elm.emojitabcontent.lastElementChild;
  while (child) {
    elm.emojitabcontent.removeChild(child);
    child = elm.emojitabcontent.lastElementChild;
  }
  for (let i = 0; i < emojiIcons.length; i++) {
    let selector = document.createElement("div");
    selector.classList.add("emojiselector");
    let text = emojiIcons[i];
    if (emojis.includes(i)) text = "?";
    if (myemoji == i) text = "❌";
    selector.appendChild(document.createTextNode(text));

    selector.addEventListener("click", () => {
      socket.talk(["switchicon", i]);
    });

    elm.emojitabcontent.appendChild(selector);
  }
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

elm.startGameButton = document.getElementById("startgamebutton");
elm.startGameButton.addEventListener("click", () => {
  if (currentpage == "gamepage") socket.talk(["startgame"]);
});

// next review button
elm.nextReviewButton = document.getElementById("nextreviewbutton");
elm.nextReviewButton.addEventListener("click", () => {
  socket.talk(["nextreview"]);
});

elm.playerCount = document.getElementById("playercount");
elm.voteText = document.getElementById("votetext");
elm.playerHolder = document.getElementById("playerholder");
elm.card = document.getElementById("cardholder");
// our websocket
class Socket {
	constructor() {
		this.socket = new WebSocket("wss://voting-game.glitch.me/ws");
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
      case "newicons": {
        if (packet[0] == undefined) break;
        try {
        serverdata.icons = packet[0];
        serverdata.myicon = packet[1];
        updateEmojis(serverdata.icons, serverdata.myicon);
        for (let c = 0; c < serverdata.players.length; c++) {
          for (let e of elm.playerHolder.children[c].children) {
            if (e.classList.contains("slideicon")) {
              e.textContent = emojiIcons[serverdata.icons[c]];
            }
          }
          for (let e of elm.gamePageNameBox.children[c].children) {
            if (e.classList.contains("slideicon")) {
              e.textContent = emojiIcons[serverdata.icons[c]];
            }
          }
        }
        } catch(err) {
          alert(err);
        }
      }
      case "gameupdate": {
        if (packet[0].players.length != serverdata.players.length) {
          serverdata.players = packet[0].players;
          serverdata.icons = packet[0].icons;
          createNames(serverdata.players, serverdata.icons);
          createNameplates(0, serverdata.players, serverdata.icons);
          elm.playerCount.innerHTML = packet[0].players.length;
        }
        adjustsettings(packet[0].hostrules);
        break;
      }
      case "newscores": {
        serverdata.scores = packet[0];
        break;
      }
      case "hoststatus": {
        if (serverdata.host == packet[0]) break;
        serverdata.host = packet[0];
        if (serverdata.host) {
          elm.startGameButton.innerHTML = "Let's Vote!";
          elm.nextReviewButton.innerHTML = "Next Player!";
        }
        else {
          elm.startGameButton.innerHTML = "Waiting for Host";
          elm.nextReviewButton.innerHTML = "Waiting for Host";
        }
          
        break;
      }
      case "startingRound": {
        if (currentpage == "gamepage") {
          swapPages("playpage", "gamepage");
          elm.card.innerHTML = packet[0];
        }
        break;
      }
      case "finalizeRound": {
        if (currentpage == "reviewpage") {
          swapPages("gamepage", "reviewpage");
          elm.voteText.innerHTML = "Place Your Votes!";
          createNames(serverdata.players, serverdata.icons);
          createNameplates(0, serverdata.players, serverdata.icons);
        }
      }
      case "voted": {
        for (let c = 0; c < serverdata.players.length; c++) {
          if (serverdata.players[c] == packet[0]) {
            elm.playerHolder.children[c].style.backgroundColor = "var(--backred)";
            break;
          }
        }
        break;
      }
      case "votes": {
        serverdata.votes = packet[0];
        createNameplates(1, serverdata.players, serverdata.icons, serverdata.votes);
        elm.voteText.innerHTML = "Guess Who Voted You!";
        break;
      }
      case "guessed": {
        for (let c = 0; c < serverdata.players.length; c++) {
          if (serverdata.players[c] == packet[0]) {
            elm.playerHolder.children[c].style.backgroundColor = "var(--backred)";
            break;
          }
        }
        break;
      }
      case "finalvotes": {
        createReviews(serverdata.players, serverdata.icons, packet[0], packet[1]);
        swapPages("reviewpage", "playpage");
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
elm.hostGameID.value = localStorage.getItem("gameid") ?? "";
elm.hostGameNickname =  document.getElementById("hostgamenickname");
elm.hostGameNickname.value = localStorage.getItem("gamenickname") ?? "";
elm.attemptHost = document.getElementById("attempthost");
elm.attemptHost.addEventListener("click", () => {
  if (currentpage != "hostinfopage") return;
  localStorage.setItem("gameid", elm.hostGameID.value);
  localStorage.setItem("gamenickname", elm.hostGameNickname.value);
  
  socket.checkSocketStatus(200, 20, () => {
    socket.talk(["host", elm.hostGameID.value, elm.hostGameNickname.value])
    swapPages("gamepage", "hostinfopage");
  }, () => {
    
  });
});

// attempt to join lobby
elm.joinGameID = document.getElementById("joingameid");
elm.joinGameID.value = localStorage.getItem("gameid") ?? "";
elm.joinGameNickname = document.getElementById("joingamenickname");
elm.joinGameNickname.value = localStorage.getItem("gamenickname") ?? "";
elm.attemptJoin = document.getElementById("attemptjoin");
elm.attemptJoin.addEventListener("click", () => {
  if (currentpage != "typenamepage") return;
  localStorage.setItem("gameid", elm.joinGameID.value);
  localStorage.setItem("gamenickname", elm.joinGameNickname.value);
  
  socket.checkSocketStatus(200, 20, () => {
    socket.talk(["join", elm.joinGameID.value, elm.joinGameNickname.value])
    swapPages("gamepage", "typenamepage");
  }, () => {
    
  });
});

// creates a player nameplate element
function createIcon(icon, text, extra, num) {
  let box = document.createElement("div");
  box.classList.add("playerslide");
  
  let boxIcon = document.createElement("div");
  boxIcon.classList.add("slideicon");
  boxIcon.appendChild(document.createTextNode(icon));
  boxIcon.style.top = (2.5 + num * 15) + "vh";
  
  box.appendChild(boxIcon);
  
  let boxName = document.createElement("div");
  boxName.classList.add("slidename");
  boxName.appendChild(document.createTextNode(text));
  boxName.style.top = (1 + num * 15) + "vh";
  
	box.appendChild(boxName);
  
  if (extra != null) {
    let boxExtra = document.createElement("div");
    boxExtra.classList.add("slideextra");
    boxExtra.appendChild(document.createTextNode(extra));
    boxExtra.style.top = (2.5 + num * 15) + "vh";

    box.appendChild(boxExtra);
  }
  return box;
}

// add the name icons when in lobby
elm.gamePageNameBox = document.getElementById("gamepagenamebox");
function createNames(names = [], icons = []) {
  let child = elm.gamePageNameBox.lastElementChild; 
  while (child) {
    elm.gamePageNameBox.removeChild(child);
    child = elm.gamePageNameBox.lastElementChild;
  }
  for (let n = 0; n < names.length; n++) {
		let box = createIcon(emojiIcons[icons[n]], names[n], serverdata.scores[n], n);

		elm.gamePageNameBox.appendChild(box);
  }
}

// create nameplates when votng
function createNameplates(type = 0, names = [], icons = [], votes = null) {
  let child = elm.playerHolder.lastElementChild; 
  while (child) {
    elm.playerHolder.removeChild(child);
    child = elm.playerHolder.lastElementChild;
  }
  for (let n = 0; n < names.length; n++) {
    let extra = null;
    {
      switch (type) {
        case 0: {
          extra = null;
          break;
        }
        case 1: {
          extra = votes[n];
          break;
        }
        case 2: {
          extra = null;
          break;
        }
      }
    }
		let box = createIcon(emojiIcons[icons[n]], names[n], extra, n);
    
    if (type === 0)
    box.addEventListener("click", () => {
      socket.talk(["vote", names[n]]);
    });
    else if (type === 1)
    box.addEventListener("click", () => {
      socket.talk(["guessvoter", names[n]]);
    });

		elm.playerHolder.appendChild(box);
  }
}

elm.showcaseHolder = document.getElementById("showcaseholder");
function createReviews(names = [], icons = [], voters = [], voted = 0) {
  let child = elm.showcaseHolder.lastElementChild; 
  while (child) {
    elm.showcaseHolder.removeChild(child);
    child = elm.showcaseHolder.lastElementChild;
  }
  let box = createIcon(emojiIcons[icons[voted]], names[voted], serverdata.scores[voted], 0);
  elm.showcaseHolder.appendChild(box);
  
  box = document.createElement("div");
  box.classList.add("playerslide");
  
  let boxName = document.createElement("div");
  boxName.classList.add("slidename");
  boxName.appendChild(document.createTextNode("Was voted by:"));
  boxName.style.top = "16vh";
  
	box.appendChild(boxName);
  elm.showcaseHolder.appendChild(box);

  for (let n = 0; n < voters[voted].length; n++) {
    let currentvoter = voters[voted][n];
		box = createIcon(emojiIcons[icons[currentvoter]], names[currentvoter], serverdata.scores[currentvoter], n + 2);

		elm.showcaseHolder.appendChild(box);
  }
}
