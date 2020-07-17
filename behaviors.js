const docEl = document.documentElement;
const remUnit = () => {
  const clientWidth = docEl.clientWidth;
  const clientHeight = docEl.clientHeight;
  return clientWidth > clientHeight ? "1vh" : "1vw";
};
const onResize = () => {
  docEl.style.fontSize = remUnit();
};

const activate = (elem) => elem.classList.add("active");
const init = () => {
  const barList = document.querySelectorAll(".animated-bar");
  const bBar = document.querySelector(".blue-bar");
  const label = document.querySelector(".title");
  const bars = document.querySelector(".bars");
  const audio = document.getElementById("audio");
  const playNow = document.getElementById("play-now");
  const showBosses = () => {
    playNow.style.display = "none";
    bars.style.visibility = "visible";
    barList.forEach(activate);
    setTimeout(() => {
      bBar.classList.add("luchadores");
    }, 1000);
    setTimeout(() => {
      activate(label);
    }, 2000);

    audio.play();
  };

  onResize();
  playNow.onclick = showBosses;
};

window.onload = init;
window.onresize = onResize;