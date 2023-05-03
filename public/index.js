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
function swapPages(open = "pageid", close = "pageid") {
  for (let opening = 0; opening < 1)
}

// lobby hosting
elm.hostButton = document.getElementById("hostbutton");
elm.hostButton.addEventListener("click", () => {
  
});