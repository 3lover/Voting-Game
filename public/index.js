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
elm.hostXButton = document.getElementById("typex");
elm.hostXButton.addEventListener("click", () => {
  swapPages("frontpage", "hostinfopage");
});