//document.documemtElement.requestFullscreen();
window. onerror = function(message) { alert(message); return true; }; 

const serverdata = {
  players: [],
  icons: [],
  colors: [],
  voted: [],
  myicon: 0,
  host: null,
  votes: [],
  scores: [],
  me: 0,
  lobbyname: "Someone",
  public: false
}
const elm = {};

let deckData = [];
let currentDeck = -1;
let selectedCard = 0;
class Deck {
  constructor(name, cards = [], hosted) {
    this.name = name;
    this.cards = cards;
    this.hosted = hosted;
    this.enabled = true;
  }
  
  sortCards() {
    this.cards.sort();
  }
}

// fullscreen button/panel on mobile
let fullscreen = true;
elm.goFS = document.getElementById("goFS");
elm.refuseFS = document.getElementById("refuseFS");
elm.mobileFSpanel = document.getElementById("mobileFSpanel");
elm.goFS.addEventListener("click", () => {
  const elem = document.documentElement;
  if (elem.requestFullscreen) elem.requestFullscreen();
  elm.mobileFSpanel.style.display = "none";
}, false);
elm.refuseFS.addEventListener("click", () => {
  elm.mobileFSpanel.style.display = "none";
  fullscreen = false;
}, false);

// if the user ever leaves full screen mode, pull the fs menu back up
function checkFS() {
  if (!fullscreen) return;
  
  if (document.fullscreenElement === null) elm.mobileFSpanel.style.display = "block";
}
document.documentElement.addEventListener("fullscreenchange", checkFS)

// dropdown menu
let settingbarDropped = false;
elm.settingbar = document.getElementById("settingbar");
elm.settingbardropdown = document.getElementById("settingbardropdown");
elm.settingbardropdown.addEventListener("click", (e) => {
  if (settingbarDropped) elm.settingbar.style.top = "-40vmin";
  else elm.settingbar.style.top = "0vmin";
  settingbarDropped = !settingbarDropped;
});

// load color pallets
let colors = "not ready";
async function getcolors() {
	colors = await (await fetch("./json/colors.json")).json();
}
getcolors();

function getRainbow() {
  let time = new Date().getTime() / 1000;
  let red = Math.floor(Math.abs(Math.sin(time * .17)) * 255);
  let green = Math.floor(Math.abs(Math.sin(time * .41)) * 255);
  let blue = Math.floor(Math.abs(Math.sin(time * .67)) * 255);
  return "rgb(" + red + ", " + green + ", " + blue + ")";
}

// load icons
let emojiIcons = "not ready";
async function geticons() {
	emojiIcons = Object.values(await (await fetch("./json/emojis.json")).json());
}
geticons();

// color scheme settings
function randomHex() {
  let n = (Math.random() * 0xfffff * 1000000).toString(16);
  return '#' + n.slice(0, 6);
};

elm.root = document.querySelector(':root');
elm.loadingpanel = document.getElementById("loadingpanel");
function remakeColors(scheme) {
  if (colors === "not ready") {
    setTimeout(() => {remakeColors(scheme)}, 1000);
    return;
  }
  
  setTimeout(() => {
    elm.loadingpanel.style.opacity = 0;
    elm.loadingpanel.style.backgroundColor = "var(--background)";
  }, 100);
  setTimeout(() => {
    elm.loadingpanel.style.display = "none";
  }, 600);
  
  for (let k in Object.keys(colors[scheme])) {
    if (scheme == "pwetty") {
      elm.root.style.setProperty(Object.keys(colors[scheme])[k], randomHex());
    } else elm.root.style.setProperty(Object.keys(colors[scheme])[k], Object.values(colors[scheme])[k]);
  }
}
elm.adjustColor = document.getElementById("adjustcolor");
elm.adjustColor.value = localStorage.getItem("adjustcolor") ?? "dark";
remakeColors(elm.adjustColor.value);
elm.adjustColor.addEventListener("change", (e) => {
  localStorage.setItem("adjustcolor", e.target.value);
  remakeColors(e.target.value);
});


// probably the least secure ban system ever, but I mean it is better than nothing maybe?
if (!localStorage.getItem("clientID")) localStorage.setItem("clientID", "#" + String(Math.floor(Math.random() * 10000000000)).padStart(10, "0"));

// page transitions
let noTransitions = localStorage.getItem("pagetransitions") == "true" ?? false;
elm.pageTransitions = document.getElementById("pagetransitions");
elm.pageTransitions.value = noTransitions ? "0" : "1";
elm.pageTransitions.addEventListener("change", () => {
  noTransitions = !noTransitions;
  localStorage.setItem("pagetransitions", noTransitions ? "true" : "false");
});

// page transitions
let waitingToJoin = false;
let currentpage = "frontpage";
elm.leftSlide = document.getElementById("lefttransitionpanel");
elm.rightSlide = document.getElementById("righttransitionpanel");
function swapPages(open = "id", close = "id") {
  currentpage = open;
  elm.settingbar.style.top = "-40vmin";
  settingbarDropped = false;
  waitingToJoin = false;
  
  if (noTransitions) {
    elm.leftSlide.style.transition = "0";
    elm.rightSlide.style.transition = "0";
    document.getElementById(open).style.display = "block";
    document.getElementById(close).style.display = "none";
    return;
  }
  
  elm.leftSlide.style.transition = "0.5s";
  elm.rightSlide.style.transition = "0.5s";
  elm.leftSlide.style.width = "50vmax";
  elm.leftSlide.style.left = "0";
  elm.rightSlide.style.width = "50vmax";
  elm.rightSlide.style.left = "50vmax";
  
  setTimeout(() => {
    document.getElementById(open).style.display = "block";
    document.getElementById(close).style.display = "none";
    elm.leftSlide.style.width = "0";
    elm.leftSlide.style.left = "-5vmin";
    elm.rightSlide.style.width = "0";
    elm.rightSlide.style.left = "100vmax";
  }, 1000);
}

// when a game page tab is clicked, color it in and view the content
elm.GPTsetting = document.getElementById("GPTsetting");
elm.GPTcards = document.getElementById("GPTcards");
elm.GPTemoji = document.getElementById("GPTemoji");
elm.GPTlogs = document.getElementById("GPTlogs");
const GPTs = [elm.GPTsetting, elm.GPTcards, elm.GPTemoji, elm.GPTlogs];
elm.settingtabcontent = document.getElementById("settingtabcontent");
elm.cardstabcontent = document.getElementById("cardstabcontent");
elm.emojitabcontent = document.getElementById("emojitabcontent");
elm.logstabcontent = document.getElementById("logstabcontent");
const contents = [elm.settingtabcontent, elm.cardstabcontent, elm.emojitabcontent, elm.logstabcontent];

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
  localStorage.setItem(id, value);
}
const settingids = [
  ["pointsystem", "select"],
  ["customvisibility", "select"],
  ["cardselectsystem", "select"],
  ["maxplayers", "input"],
  ["pwetty", "select"],
];
for (let i of settingids) {
  document.getElementById(i[0]).addEventListener(i[1] == "select" || i[1] == "input" ? "change" : "click", (e) => {
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
    else if (i[1] == "input" && currentelement !== document.activeElement) currentelement.value = newvalues[i[0]];
  }
}


// create the emoji tabs
elm.changeColorButton = document.getElementById("changecolorbutton");
elm.changeColorPage = document.getElementById("changecolorpage");
elm.changeColorButton.addEventListener("click", () => {
  elm.changeColorPage.style.top = "25vmin";
  elm.greyedPanel.style.display = "block";
});

elm.colorSelect = document.getElementById("colorselect");
elm.customColorInput = document.getElementById("customcolorinput");
elm.colorSelect.addEventListener("change", (e) => {
  if (e.target.value !== "custom") {
    elm.customColorInput.style.display = "none";
    localStorage.setItem("prefColor", e.target.value);
    elm.customColorInput.value = e.target.value;
    socket.talk(["updateColor", e.target.value]);
  }
  else {
    elm.customColorInput.style.display = "block";
  }
});

elm.colorDone = document.getElementById("colordone");
elm.colorDone.addEventListener("click", () => {
  elm.changeColorPage.style.top = "-60vmin";
  elm.greyedPanel.style.display = "none";
});

if (!localStorage.getItem("prefColor")) localStorage.setItem("prefColor", "#ff0000");
for (let o of elm.colorSelect.options)
  if (o.value === localStorage.getItem("prefColor")) {
    elm.colorSelect.value = localStorage.getItem("prefColor");
    elm.customColorInput.style.display = "none";
  }
elm.customColorInput.value = localStorage.getItem("prefColor");

elm.customColorInput.addEventListener("change", (e) => {
  if (elm.colorSelect.value !== "custom") return;
  let testColor = new Option().style;
  testColor.color = e.target.value;
  if (testColor.color === '' && e.target.value !== "rainbow") {
    e.target.value = localStorage.getItem("prefColor");
    return;
  }
  localStorage.setItem("prefColor", e.target.value);
  socket.talk(["updateColor", e.target.value]);
});

elm.emojiHolder = document.getElementById("emojitabholder")
function updateEmojis(emojis, myemoji) {
  let child = elm.emojiHolder.lastElementChild;
  while (child) {
    elm.emojiHolder.removeChild(child);
    child = elm.emojiHolder.lastElementChild;
  }
  for (let i = 0; i < emojiIcons.length; i++) {
    let selector = document.createElement("div");
    selector.classList.add("emojiselector");
    let text = emojiIcons[i];
    //if (emojis.includes(i)) text = "?";
    if (myemoji == i) text = "❌";
    selector.appendChild(document.createTextNode(text));

    selector.addEventListener("click", () => {
      socket.talk(["switchicon", i]);
    });

    elm.emojiHolder.appendChild(selector);
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
elm.findButton = document.getElementById("findbutton");
elm.findButton.addEventListener("click", () => {
  swapPages("findpage", "frontpage");
  socket.talk(["getLobbyList"]);
});

// find page x button
elm.findXButton = document.getElementById("findx");
elm.findXButton.addEventListener("click", () => {
  swapPages("frontpage", "findpage");
});

// find page refresh
elm.findReloadButton = document.getElementById("findreload");
elm.findReloadButton.addEventListener("click", () => {
  socket.talk(["getLobbyList"]);
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

// alert page x
elm.alertXButton = document.getElementById("alertx");
elm.alertXButton.addEventListener("click", () => {
  swapPages("frontpage", "alertpage");
});


// cycle card button
elm.refreshButton = document.getElementById("refreshbutton");
elm.refreshButton.addEventListener("click", () => {
  socket.talk(["refreshcard"]);
});

// back to lobby button
elm.backToLobbyButton = document.getElementById("backtolobbybutton");
elm.backToLobbyButton.addEventListener("click", () => {
  socket.talk(["backToLobby"]);
});

// next review button
elm.nextReviewButton = document.getElementById("nextreviewbutton");
elm.nextReviewButton.addEventListener("click", () => {
  socket.talk(["nextreview"]);
});

let addons = [" is writing, but these messages haven't loaded yet."];
async function getAddOns() {
	addons = await (await fetch("./json/addons.json")).json();
}
getAddOns();

// game logs
function addLog(alllogs = []) {
  let savedScroll = elm.logstabcontent.scrollTop;
  if (savedScroll === elm.logstabcontent.scrollHeight) savedScroll = -1;
  let child = elm.logstabcontent.lastElementChild;
  while (child) {
    elm.logstabcontent.removeChild(child);
    child = elm.logstabcontent.lastElementChild;
  }
  
  for (let l of alllogs) {
    let tab = document.createElement("div");
    tab.classList.add("logstab");

    tab.innerText = l.text;
    tab.style.color = l.color;
    tab.addEventListener("click", () => {
      copyToClip(tab.innerText);
    });

    elm.logstabcontent.appendChild(tab);
  }
  if (savedScroll === -1) elm.logstabcontent.scrollTop = elm.logstabcontent.scrollHeight;
  else elm.logstabcontent.scrollTop = savedScroll;
}
// the find lobby panel generation
elm.findLobbyHolder = document.getElementById("findlobbyholder");
function generateFindList(lobbies) {
  let child = elm.findLobbyHolder.lastElementChild;
  while (child) {
    elm.findLobbyHolder.removeChild(child);
    child = elm.findLobbyHolder.lastElementChild;
  }
  for (let l of lobbies) {
    let tab = document.createElement("div");
    tab.classList.add("lobbytab");

    tab.appendChild(document.createTextNode(l.name + ` (${l.players}/${l.maxplayers})`));
    tab.addEventListener("click", () => {
        if (currentpage != "findpage") return;
        swapPages("typenamepage", "findpage");
        elm.joinGameID.value = l.id;
    });

    elm.findLobbyHolder.appendChild(tab);
  }
}

// the decks panel
let unfilteredDecks = [];
document.addEventListener("keydown", (e) => {
  if (e.key !== "D" || !e.shiftKey || currentpage !== "frontpage") return;
  let pushing = unfilteredDecks.filter((c) => {
    return c.dirty;
  });
  for (let p of pushing) deckData.push(p);
  alert("dirty decks uploaded and saved!");
  saveDeckData();
});

async function setDeckToDefaults(newest = false) {
	unfilteredDecks = await (await fetch("./json/cards.json")).json();
  if (newest) {
    deckData = unfilteredDecks.filter((c) => {
      return !c.dirty;
    });
    saveDeckData();
  }
}

function saveDeckData() {
  let stringified = deckData.filter(deck => !deck.hosted);
  stringified = JSON.stringify(stringified);
  localStorage.setItem("deckdata", stringified);
  if (!serverdata.host) return;
  let cardsSent = deckData.filter(deck => deck.enabled);
  socket.talk(["updateHostedCards", cardsSent]);
}
if (localStorage.getItem("deckdata")) {
  setDeckToDefaults(false);
  deckData = JSON.parse(localStorage.getItem("deckdata"));
}
else setDeckToDefaults(true);

function download(filename, text) {
  let element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function importFile(file) {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function() {
    let formattedCardData = reader.result.split("\n");
    // remove the line break from the end of the file if present
    if (formattedCardData[formattedCardData.length - 1].length < 1) formattedCardData.pop();
    deckData.push(new Deck(elm.customCardFile.files.item(0).name.replace(".txt", ""), formattedCardData, false));
    currentDeck = -1;
    fillDeckView();
  }
}
function resizeInput(input) {
  input.style.height = 0;
  input.style.height = `calc(${input.scrollHeight}px + 1vmin)`;
}

elm.deckBack = document.getElementById("deckback");
elm.deckBack.addEventListener("click", () => {
  currentDeck = -1;
  fillDeckView();
});

elm.deckToggle = document.getElementById("decktoggle");
elm.deckToggle.addEventListener("click", () => {
  deckData[currentDeck].enabled = !deckData[currentDeck].enabled;
  elm.deckToggle.innerText = deckData[currentDeck].enabled ? "Enabled" : "Disabled";
  saveDeckData();
});

elm.deckHolder = document.getElementById("deckholder");
elm.deckOptionsHolder = document.getElementById("deckoptionsholder");
elm.cardstabcontent.addEventListener("wheel", (e) => {
  if (e.deltaY < 0) {
    elm.deckOptionsHolder.style.position = "sticky";
  }
  else {
    elm.deckOptionsHolder.style.position = "relative";
  }
});

elm.exportDeck = document.getElementById("exportdeck");
elm.exportDeck.addEventListener("click", () => {
  let exportText = "";
  for (let i = 0; i < deckData[currentDeck].cards.length; i++) exportText += deckData[currentDeck].cards[i] + "\n";
  download(deckData[currentDeck].name, exportText);
})

elm.customCardFile = document.getElementById("customcardfile");
elm.customFileButton = document.getElementById("customcardfilebtn");
elm.customCardsInput = document.getElementById("customcardsinput");
elm.greyedPanel = document.getElementById("greyedpanel");
elm.cancelCustom = document.getElementById("cancelcustom");
elm.confirmCustom = document.getElementById("confirmcustom");
elm.importDeck = document.getElementById("importdeck");
elm.importDeck.addEventListener("click", () => {
  elm.customCardsInput.style.top = "25vmin";
  elm.greyedPanel.style.display = "block";
});
elm.cancelCustom.addEventListener("click", () => {
  elm.customCardsInput.style.top = "-60vmin";
  elm.greyedPanel.style.display = "none";
});
elm.confirmCustom.addEventListener("click", () => {
  elm.customCardsInput.style.top = "-60vmin";
  elm.greyedPanel.style.display = "none";
  importFile(elm.customCardFile.files.item(0));
});
elm.customCardFile.addEventListener("change", () => {
  elm.customFileButton.innerText = elm.customCardFile.files.item(0).name;
});

elm.newDeck = document.getElementById("newdeck");
elm.newDeck.addEventListener("click", () => {
  deckData.push(new Deck("New Deck", [], false));
  fillDeckView();
  saveDeckData();
});

elm.newCard = document.getElementById("newcard");
elm.newCard.addEventListener("click", () => {
  deckData[currentDeck].cards.push("");
  fillDeckView(true);
  saveDeckData();
});

let deletingCards = false;
elm.confirmCardDelete = document.getElementById("confirmcarddelete");
elm.confirmCardDelete.addEventListener("click", () => {
  elm.cardDeletePanel.style.top = "-60vmin";
  elm.greyedPanel.style.display = "none";
  if (currentDeck !== -1) deckData[currentDeck].cards.splice(selectedCard, 1);
  else deckData.splice(selectedCard, 1);
  fillDeckView(true);
  saveDeckData();
  deletingCards = true;
  setTimeout(() => {
    deletingCards = false;
  }, 10000);
});
elm.cancelCardDelete = document.getElementById("cancelcarddelete");
elm.cancelCardDelete.addEventListener("click", () => {
  elm.cardDeletePanel.style.top = "-60vmin";
  elm.greyedPanel.style.display = "none";
});

elm.deckNameInput = document.getElementById("decknameinput");
elm.deckNameInput.addEventListener("change", (e) => {
  deckData[currentDeck].name = e.target.value;
  saveDeckData();
});

elm.cardDeletePanel = document.getElementById("carddeletepanel");
function fillDeckView(keepScroll = false) {
  let usedPlates;
  
  // sort decks, with hosted decks being put at the top
  deckData.sort((a, b) => {
    if (a.hosted && !b.hosted) return -1;
    if (!a.hosted && b.hosted) return 1;
    return 0;
  });
  
  elm.deckNameInput.disabled = false;
  if (currentDeck !== -1) {
    usedPlates = deckData[currentDeck].cards;
    elm.exportDeck.style.display = "block";
    elm.importDeck.style.display = "none";
    elm.deckBack.style.display = "block";
    elm.newDeck.style.display = "none";
    elm.newCard.style.display = "block";
    elm.deckNameInput.style.display = "block";
    elm.deckToggle.style.display = "block";
    elm.deckToggle.innerText = deckData[currentDeck].enabled ? "Enabled" : "Disabled";
    elm.deckNameInput.value = deckData[currentDeck].name;
    if (deckData[currentDeck].hosted) {
      elm.newCard.style.display = "none";
      elm.deckNameInput.disabled = true;
    }
  }
  else {
    usedPlates = [];
    for (let i = 0; i < deckData.length; i++) {
      usedPlates.push(deckData[i].name);
    }
    elm.exportDeck.style.display = "none";
    elm.importDeck.style.display = "block";
    elm.deckBack.style.display = "none";
    elm.newDeck.style.display = "block";
    elm.newCard.style.display = "none";
    elm.deckNameInput.style.display = "none";
    elm.deckToggle.style.display = "none";
  }
  
  let cc = elm.deckHolder;
  let savedScroll = 0;
  if (keepScroll) savedScroll = elm.cardstabcontent.scrollTop;
  
  let child = cc.lastElementChild;
  while (child) {
    cc.removeChild(child);
    child = cc.lastElementChild;
  }
    
  for (let i = 0; i < usedPlates.length; i++) {
    let tab = currentDeck === -1 ? document.createElement("div") : document.createElement("textarea");
    tab.classList.add(currentDeck === -1 ? "deckpaneltab" : "deckpanelinput");
    
    if (currentDeck === -1 && deckData[i].hosted) {
      tab.classList.add("hostedtab");
    }
    else if (currentDeck !== -1 && deckData[currentDeck].hosted) {
      tab.classList.add("hostedtab");
      tab.disabled = true;
    }
    
    if (currentDeck !== -1) {
      tab.value = usedPlates[i];
      tab.addEventListener("input", () => {resizeInput(tab)});
      tab.addEventListener("change", (e) => {
        deckData[currentDeck].cards[i] = e.target.value;
        saveDeckData();
      });
      tab.addEventListener("contextmenu", () => {
        if (deckData[currentDeck].hosted) return;
        if (deletingCards) {
          deckData[currentDeck].cards.splice(i, 1);
          fillDeckView(true);
          saveDeckData();
          return;
        }
        selectedCard = i;
        elm.cardDeletePanel.style.top = "25vmin";
        elm.greyedPanel.style.display = "block";
      });
    }
    else tab.appendChild(document.createTextNode(usedPlates[i] + (deckData[i].hosted ? " (H)" : "")));
    
    if (currentDeck === -1) {
      tab.addEventListener("click", () => {
        currentDeck = i;
        fillDeckView();
      });
      tab.addEventListener("contextmenu", () => {
        if (deckData[i].hosted) {
          deckData.push(new Deck(deckData[i].name, deckData[i].cards, false));
          fillDeckView();
          saveDeckData();
          return;
        }
        if (deletingCards) {
          deckData.splice(i, 1);
          fillDeckView(true);
          saveDeckData();
          return;
        }
        selectedCard = i;
        elm.cardDeletePanel.style.top = "25vmin";
        elm.greyedPanel.style.display = "block";
      });
    }
    
    cc.appendChild(tab);
    
    if (currentDeck !== -1) resizeInput(tab);
  }
  if (keepScroll) {
    elm.cardstabcontent.scrollTop = savedScroll;
  }
  elm.deckOptionsHolder.style.top = "0px";
}
fillDeckView();


function refreshIcons() {
          for (let c = 0; c < serverdata.players.length; c++) {
          for (let e of elm.playerHolder.children[c].children) {
            if (e.classList.contains("slideicon")) {
              e.innerText = emojiIcons[serverdata.icons[c]];
              e.style.color = serverdata.colors[c] === "rainbow" ? getRainbow() : serverdata.colors[c];
            }
          }
          for (let e of elm.gamePageNameBox.children[c].children) {
            if (e.classList.contains("slideicon")) {
              e.innerText = emojiIcons[serverdata.icons[c]];
              e.style.color = serverdata.colors[c] === "rainbow" ? getRainbow() : serverdata.colors[c];
            }
          }
        }
}

// start game button
elm.startGameButton = document.getElementById("startgamebutton");
elm.startGameButton.addEventListener("click", () => {
  if (!serverdata.host) return;
  let cardsSent = deckData.filter(deck => deck.enabled);
  socket.talk(["updateHostedCards", cardsSent]);
  socket.talk(["startgame"]);
});

// lobby publicity and custom card visibility
elm.publicLobby = document.getElementById("publiclobby");
elm.publicLobby.addEventListener("change", () => {
  socket.talk(["publicitychange"]);
});

elm.cardTypingArea = document.getElementById("cardtypingarea");
elm.typingSubmit = document.getElementById("typingsubmit");
elm.typingIdea = document.getElementById("typingidea");
elm.typingSubmit.addEventListener("click", () => {
  socket.talk(["submitTyped", elm.cardTypingArea.value]);
});
elm.typingIdea.addEventListener("click", () => {
  socket.talk(["generateIdeas"]);
});

// how to play
elm.closeHowToPlay = document.getElementById("closehowtoplay");
elm.howToPlayButton = document.getElementById("howtoplaybutton");
elm.howtoPlayPanel = document.getElementById("howtoplay");
elm.howToPlayButton.addEventListener("click", () => {
  elm.closeHowToPlay.style.display = "block";
  elm.howtoPlayPanel.style.display = "block";
});
elm.closeHowToPlay.addEventListener("click", () => {
  elm.closeHowToPlay.style.display = "none";
  elm.howtoPlayPanel.style.display = "none";
});

// leave lobby
elm.leaveGameButton = document.getElementById("leavegamebutton");
elm.leaveGameButton.addEventListener("click", () => {
  socket.talk(["leaveGame"]);
  elm.leaveGameButton.style.display = "none";
  swapPages("frontpage", currentpage);
});

elm.gamePageTitle = document.getElementById("gamepagetitle");
elm.titleOptionsPanel = document.getElementById("titleoptionspanel");
elm.gamePageTitle.addEventListener("click", () => {
  elm.titleOptionsPanel.style.top = "10vmin";
  elm.greyedPanel.style.display = "block";
});

elm.titleCancel = document.getElementById("titleoptionscancel");
elm.titleCancel.addEventListener("click", () => {
  elm.titleOptionsPanel.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
});

elm.titleIdInput = document.getElementById("titleoptionsidinput");
elm.titleIdInput.addEventListener("change", () => {
  if (elm.titleIdInput.classList.contains("redborder")) elm.titleIdInput.classList.remove("redborder");
});

elm.titleIdChange = document.getElementById("titleoptionsid");
elm.titleIdChange.addEventListener("click", () => {
  socket.talk(["changeLobbyId", elm.titleIdInput.value]);
  elm.titleOptionsPanel.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
});

elm.titleNameInput = document.getElementById("titleoptionsnameinput");
elm.titleNameChange = document.getElementById("titleoptionsname");
elm.titleNameChange.addEventListener("click", () => {
  socket.talk(["changeLobbyName", elm.titleNameInput.value]);
  elm.titleOptionsPanel.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
});

elm.titleBanErase = document.getElementById("titleoptionsban");
elm.titleBanErase.addEventListener("click", () => {
  socket.talk(["eraseBanList"]);
  elm.titleOptionsPanel.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
});

async function copyToClip(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("copied to clipboard!");
  } catch (err) {
    alert("copying failed due to " + err);
  }
}
elm.card = document.getElementById("cardholder");
elm.card.addEventListener("click", () => {
  copyToClip(elm.card.innerText);
});

let goToBottom = false;
elm.playerCount = document.getElementById("playercount");
elm.voteText = document.getElementById("votetext");
elm.playerHolder = document.getElementById("playerholder");
elm.alertText = document.getElementById("alerttext");
elm.alertTitle = document.getElementById("alerttitle");

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
        break;
      }
      case "newicons": {
        if (packet[0] == undefined) break;
        try {
        serverdata.icons = packet[0];
        serverdata.myicon = packet[1];
        serverdata.colors = packet[2];
        updateEmojis(serverdata.icons, serverdata.myicon);
        refreshIcons();
        } catch(err) {
          alert(err);
        }
        break;
      }
      case "newlog": {
        addLog(packet[0]);
        break;
      }
      case "typingcard": {
        elm.card.innerText = packet[0] + addons[Math.floor(addons.length * Math.random())] + "\n\n" + packet[1];
        elm.card.style.display = "block";
        elm.cardTypingArea.style.display = "none";
        elm.typingSubmit.style.display = "none";
        elm.typingIdea.style.display = "none";
        if (currentpage == "gamepage") {
          swapPages("playpage", "gamepage");
        }
        break;
      }
      case "starttyping": {
        elm.card.style.display = "none";
        elm.cardTypingArea.style.display = "block";
        elm.cardTypingArea.value = "Who is most likely to ";
        elm.cardTypingArea.placeholder = "Who is most likely to ";
        elm.typingSubmit.style.display = "block";
        elm.typingIdea.style.display = "block";
        if (currentpage == "gamepage") {
          swapPages("playpage", "gamepage");
        }
        break;
      }
      case "ideasGenerated": {
        elm.cardTypingArea.placeholder = packet[0] + "\n\nStill lost? Submiting a blank card pulls a random card from the host's collection for you to edit.";
        elm.cardTypingArea.value = "";
        break;
      }
      case "typingDone": {
        elm.card.style.display = "block";
        elm.cardTypingArea.style.display = "none";
        elm.typingSubmit.style.display = "none";
        elm.typingIdea.style.display = "none";
        elm.card.innerText = packet[0];
        break;
      }
      case "cardSentToTyper": {
        elm.cardTypingArea.value = packet[0];
        break;
      }
      case "cardrefreshed": {
        //if (!packet[1]) elm.card.innerText = packet[0];
        createNameplates(0, serverdata.players, serverdata.icons);
        break;
      }
      case "sendme": {
        serverdata.me = packet[0];
        break;
      }
      case "cannotChangeId": {
        elm.titleIdInput.classList.add("redborder");
        elm.titleOptionsPanel.style.top = "10vmin";
        elm.greyedPanel.style.display = "block";
        break;
      }
      case "pwettychange": {
        if (packet[0]) for (let e of document.getElementsByTagName("*")) e.classList.add("notransition");
        else {
          for (let e of document.getElementsByTagName("*")) e.classList.remove("notransition");
          remakeColors(elm.adjustColor.value);
        }
        break;
      }
      case "gameupdate": {
        if (packet[0].pwetty) remakeColors("pwetty");
        serverdata.lobbyname = packet[0].lobbyname;
        serverdata.public = packet[0].lobbypublicity;
        elm.publicLobby.value = serverdata.public ? "1" : "0";
        elm.gamePageTitle.innerText = serverdata.lobbyname;
        refreshIcons();
        if (packet[0].players.length != serverdata.players.length || packet[1]) {
          serverdata.players = packet[0].players;
          serverdata.icons = packet[0].icons;
          serverdata.colors = packet[0].colors;
          for (let c of serverdata.colors) {
            let testColor = new Option().style;
            testColor.color = c;
            if (testColor.color === '') c = "#ffc0cb";
          }
          createNames(serverdata.players, serverdata.icons, packet[0].me);
          createNameplates(0, serverdata.players, serverdata.icons);
          elm.playerCount.innerText = packet[0].players.length;
        }
        adjustsettings(packet[0].hostrules);
        break;
      }
      case "newscores": {
        serverdata.scores = packet[0];
        break;
      }
      case "hoststatus": {
        if ((packet[1] === 0 || packet[1] === 3) && packet[0]) {
          elm.refreshButton.style.display = "block";
          elm.backToLobbyButton.style.display = "block";
        }
        else {
          elm.refreshButton.style.display = "none";
          elm.backToLobbyButton.style.display = "none";
        }
        
        if (serverdata.host == packet[0]) return;
        serverdata.host = packet[0];
        if (serverdata.host) {
          if (!elm.gamePageTitle.classList.contains("gamepagetitlehost")) elm.gamePageTitle.classList.add("gamepagetitlehost");
          elm.startGameButton.innerText = "Let's Vote!";
          elm.nextReviewButton.innerText = "Next Player!";
          deckData = deckData.filter(deck => !deck.hosted);
          fillDeckView();
        }
        else {
          if (elm.gamePageTitle.classList.contains("gamepagetitlehost")) elm.gamePageTitle.classList.remove("gamepagetitlehost");
          elm.startGameButton.innerText = "Waiting for Host";
          elm.nextReviewButton.innerText = "Waiting for Host";
        }
          
        break;
      }
      case "startingRound": {
        if (currentpage == "gamepage") swapPages("playpage", "gamepage");
        elm.card.style.display = "block";
        elm.cardTypingArea.style.display = "none";
        elm.card.innerText = packet[0];
        break;
      }
      case "finalizeRound": {
        if (currentpage == "playpage") {
          swapPages("gamepage", "playpage");
          elm.voteText.innerText = "Place Your Votes!";
          createNames(serverdata.players, serverdata.icons);
          createNameplates(0, serverdata.players, serverdata.icons);
        }
        if (currentpage == "reviewpage") {
          swapPages("gamepage", "reviewpage");
          elm.voteText.innerText = "Place Your Votes!";
          createNames(serverdata.players, serverdata.icons);
          createNameplates(0, serverdata.players, serverdata.icons);
        }
        break;
      }
      case "voted": {
        elm.playerHolder.children[packet[0]].style.backgroundColor = "var(--lightred)";
        break;
      }
      case "unvoted": {
        elm.playerHolder.children[packet[0]].style.backgroundColor = "var(--background)";
        break;
      }
      case "showVotingStatus": {
        serverdata.voted = packet[0];
        for (let c = 0; c < serverdata.players.length; c++) {
          if (serverdata.voted.includes(c)) {
            elm.playerHolder.children[c].children[1].style.color = "var(--green)";
          } else {
            elm.playerHolder.children[c].children[1].style.color = "var(--text)";
          }
        }
        break;
      }
      case "votes": {
        serverdata.votes = packet[0];
        createNameplates(1, serverdata.players, serverdata.icons, serverdata.votes);
        elm.voteText.innerText = "Guess Who Voted You!";
        break;
      }
      case "guessed": {
        elm.playerHolder.children[packet[0]].style.backgroundColor = "var(--lightred)";
        break;
      }
      case "unguessed": {
        elm.playerHolder.children[packet[0]].style.backgroundColor = "var(--background)";
        break;
      }
      case "finalvotes": {
        setTimeout(() => {
          createReviews(serverdata.players, serverdata.icons, packet[0], packet[1]);
        }, (currentpage == "reviewpage" && !noTransitions) ? 500 : 0);
        swapPages("reviewpage", "playpage");
        break;
      }
      case "tryRejoining": {
        if (!waitingToJoin) break;
        socket.talk(["join", packet[0], elm.joinGameNickname.value, localStorage.getItem("clientID"), localStorage.getItem("prefColor")]);
        swapPages("gamepage", "alertpage");
        break;
      }
      case "failedjoin": {
        elm.leaveGameButton.style.display = "none";
        switch (packet[0]) {
          case 0: {
            elm.alertText.innerText = "The lobby code you entered does not exist, ask your host for the correct code.";
            elm.alertTitle.innerText = "Lobby Not Found!";
            swapPages("alertpage", "gamepage");
            break;
          }
          case 1: {
            elm.alertText.innerText = "The lobby code you tried to join is full, try joining later or asking the host to increase the player limit.";
            elm.alertTitle.innerText = "Lobby Full!";
            swapPages("alertpage", "gamepage");
            break;
          }
          case 2: {
            elm.alertText.innerText = "The lobby tried to join is currently in a game. If you still want to join, stay on this page and you will automatically join when they finish.";
            elm.alertTitle.innerText = "Lobby In Game!";
            swapPages("alertpage", "gamepage");
            waitingToJoin = true;
            break;
          }
          case 3: {
            console.log("Tried to host an existing lobby, joining the active one instead")
            socket.talk(["join", elm.hostGameID.value, elm.hostGameNickname.value, localStorage.getItem("clientID"), localStorage.getItem("prefColor")]);
            elm.leaveGameButton.style.display = "block";
            break;
          }
          case 4: {
            elm.alertText.innerText = "This lobby has you banned!\nIf you think this is a mistake you can ask the host to make a new lobby, or you can play with some cooler people who won't ban you.";
            elm.alertTitle.innerText = "You Were Banned!";
            swapPages("alertpage", currentpage);
            break;
          }
          case 5: {
            elm.alertText.innerText = "Something went wrong with your verification, make sure your unique connection id is able to save.";
            elm.alertTitle.innerText = "Invalid Join Request";
            swapPages("alertpage", "gamepage");
            break;
          }
          case 6: {
            elm.alertText.innerText = "You were kicked from the lobby! You can rejoin if you want, but remember that the host can permanently ban you if they choose.";
            elm.alertTitle.innerText = "You Were Kicked!";
            swapPages("alertpage", currentpage);
            break;
          }
        }
        break;
      }
      case "hostedCards": {
        deckData = deckData.filter(deck => !deck.hosted);
        if (serverdata.host) return;
        
        for (let i = 0; i < packet[0].length; i++) {
          deckData.push(new Deck(packet[0][i], packet[1][i], true));
        }
        fillDeckView();
        break;
      }
      case "sentLobbyList": {
        generateFindList(packet[0]);
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
elm.hostGameID.value = localStorage.getItem("gameid") ?? "";
elm.hostGameNickname =  document.getElementById("hostgamenickname");
elm.hostGameNickname.value = localStorage.getItem("gamenickname") ?? "";
elm.attemptHost = document.getElementById("attempthost");
elm.attemptHost.addEventListener("click", () => {
  if (currentpage != "hostinfopage") return;
  localStorage.setItem("gameid", elm.hostGameID.value);
  localStorage.setItem("gamenickname", elm.hostGameNickname.value);
  
  socket.checkSocketStatus(100, 20, () => {
    let cardsSent = deckData.filter(deck => deck.enabled);
    socket.talk(["host", elm.hostGameID.value, elm.hostGameNickname.value, cardsSent, {
      pointsystem: localStorage.getItem("pointsystem") ?? 2,
      customvisibility: localStorage.getItem("customvisibility") ?? 0,
      cardselectsystem: localStorage.getItem("cardselectsystem") ?? 0,
      maxplayers: localStorage.getItem("maxplayers") ?? 8,
      color: localStorage.getItem("prefColor")
    }]);
    swapPages("gamepage", "hostinfopage");
    elm.leaveGameButton.style.display = "block";
    elm.titleIdInput.value = elm.hostGameID.value;
    elm.titleNameInput.value = elm.hostGameNickname.value + "'s Lobby";
  }, () => {
    if (currentpage !== "hostinfopage") return;
    elm.alertText.innerText = "We could not connect you to the server after 20 attempts (2000ms). We are refreshing your connection, please try again. Check your internet if this persists, or it could be the developer is making changes right now.";
    elm.alertTitle.innerText = "Connection Not Found!";
    swapPages("alertpage", "hostinfopage");
    socket = new Socket();
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
  
  socket.checkSocketStatus(100, 20, () => {
    socket.talk(["join", elm.joinGameID.value, elm.joinGameNickname.value, localStorage.getItem("clientID"), localStorage.getItem("prefColor")]);
    swapPages("gamepage", "typenamepage");
    elm.leaveGameButton.style.display = "block";
  }, () => {
    if (currentpage !== "typenamepage") return;
    elm.alertText.innerText = "We could not connect you to the server after 20 attempts (2000ms). We are refreshing your connection, please try again. Check your internet if this persists, or it could be the developer is making changes right now.";
    elm.alertTitle.innerText = "Connection Not Found!";
    swapPages("alertpage", "typenamepage");
    socket = new Socket();
  });
});

// creates a player nameplate element
function createIcon(icon, text, extra, num, myplate = false, iconcolor = "#ffffff") {
  let box = document.createElement("div");
  box.classList.add("playerslide");
  if (myplate) box.classList.add("myslide");
  
  let boxIcon = document.createElement("div");
  boxIcon.classList.add("slideicon");
  if (icon != undefined) boxIcon.appendChild(document.createTextNode(icon));
  else boxIcon.appendChild(document.createTextNode("🥚"));
  boxIcon.style.top = (2.5 + num * 15) + "vmin";
  boxIcon.style.color = iconcolor === "rainbow" ? getRainbow() : iconcolor;
  
  box.appendChild(boxIcon);
  
  let boxName = document.createElement("div");
  boxName.classList.add("slidename");
  boxName.appendChild(document.createTextNode(text));
  boxName.style.top = (1 + num * 15) + "vmin";
  
	box.appendChild(boxName);
  
  if (extra != null) {
    let boxExtra = document.createElement("div");
    boxExtra.classList.add("slideextra");
    boxExtra.appendChild(document.createTextNode(extra));
    boxExtra.style.top = (1 + num * 15) + "vmin";

    box.appendChild(boxExtra);
  }
  return box;
}

// add the name icons when in lobby
let controlledPlayer = 0;
elm.banWindow = document.getElementById("banwindow");
elm.banWindowCancel = document.getElementById("banwindowcancel");
elm.banWindowCancel.addEventListener("click", () => {
  elm.banWindow.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
});

elm.banWindowName = document.getElementById("banwindowname");
elm.renameInput = document.getElementById("banwindownameinput");
elm.banWindowName.addEventListener("click", () => {
  elm.banWindow.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
  socket.talk(["renamePlayer", controlledPlayer, elm.renameInput.value]);
});

elm.banWindowScore = document.getElementById("banwindowscore");
elm.rescoreInput = document.getElementById("banwindowscoreinput");
elm.banWindowScore.addEventListener("click", () => {
  elm.banWindow.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
  socket.talk(["overridePlayerScore", controlledPlayer, elm.rescoreInput.value]);
});

elm.banWindowTransfer = document.getElementById("banwindowtransfer");
elm.banWindowTransfer.addEventListener("click", () => {
  elm.banWindow.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
  socket.talk(["transferHost", controlledPlayer]);
});

elm.banWindowBan = document.getElementById("banwindowban");
elm.banWindowBan.addEventListener("click", () => {
  elm.banWindow.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
  socket.talk(["banPlayer", controlledPlayer]);
});

elm.banWindowKick = document.getElementById("banwindowkick");
elm.banWindowKick.addEventListener("click", () => {
  elm.banWindow.style.top = "-90vmin";
  elm.greyedPanel.style.display = "none";
  socket.talk(["kickPlayer", controlledPlayer]);
});

elm.gamePageNameBox = document.getElementById("gamepagenamebox");
function createNames(names = [], icons = []) {
  let child = elm.gamePageNameBox.lastElementChild; 
  while (child) {
    elm.gamePageNameBox.removeChild(child);
    child = elm.gamePageNameBox.lastElementChild;
  }
  for (let n = 0; n < names.length; n++) {
		let box = createIcon(emojiIcons[icons[n]], names[n], serverdata.scores[n] + (serverdata.scores[n] === 1 ? " Point" : " Points"), n, n == serverdata.me, serverdata.colors[n]);
    let largest = -1;
    for (let i of serverdata.scores) {
      largest = Math.max(largest, i);
    }
    if (serverdata.scores[n] === largest) {
      box.children[1].style.color = "var(--green)";
    }
    
    box.addEventListener("contextmenu", () => {
      if (!serverdata.host) return;
      elm.banWindow.style.top = "10vmin";
      elm.greyedPanel.style.display = "block";
      controlledPlayer = n;
    });
    
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
          extra = votes[n] + (votes[n] === 1 ? " Vote" : " Votes");
          break;
        }
        case 2: {
          extra = null;
          break;
        }
      }
    }
		let box = createIcon(emojiIcons[icons[n]], names[n], extra, n, n == serverdata.me, serverdata.colors[n]);
    
    box.addEventListener("contextmenu", () => {
      if (!serverdata.host) return;
      elm.banWindow.style.top = "10vmin";
      elm.greyedPanel.style.display = "block";
      controlledPlayer = n;
    });
    
    if (type === 0)
    box.addEventListener("click", () => {
      socket.talk(["vote", n]);
    });
    else if (type === 1)
    box.addEventListener("click", () => {
      socket.talk(["guessvoter", n]);
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
  let box = createIcon(emojiIcons[icons[voted]], names[voted], serverdata.scores[voted] + (serverdata.scores[voted] === 1 ? " Point" : " Points"), 0, serverdata.me == voted, serverdata.colors[voted]);
  elm.showcaseHolder.appendChild(box);
  
  box = document.createElement("div");
  box.classList.add("playerslide");
  
  let boxName = document.createElement("div");
  boxName.classList.add("slidename");
  boxName.appendChild(document.createTextNode("Was voted by:"));
  boxName.style.top = "16vmin";
  
	box.appendChild(boxName);
  elm.showcaseHolder.appendChild(box);

  for (let n = 0; n < voters[voted].length; n++) {
    let currentvoter = voters[voted][n];
		box = createIcon(emojiIcons[icons[currentvoter]], names[currentvoter], serverdata.scores[currentvoter] + (serverdata.scores[currentvoter] === 1 ? " Point" : " Points"), n + 2, serverdata.me == currentvoter, serverdata.colors[currentvoter]);

		elm.showcaseHolder.appendChild(box);
  }
}