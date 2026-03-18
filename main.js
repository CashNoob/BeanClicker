/*--Variables--*/

const bean = document.querySelector(".bean");
let beanAmount = parseInt(localStorage.getItem('beans')) || 0;
let beanDisplay = document.getElementById("beans");
let beanPic = document.getElementById("beanpic");
const beanSound = new Audio('bean.m4a');

/*--Functions--*/

function beanclicker() {
    beanAmount++;
    beanDisplay.textContent = beanAmount;
    localStorage.setItem('beans', beanAmount);
    playAudio();
    spawnFloatText();
}

function playAudio() {
    const sound = beanSound.cloneNode();
    sound.volume = 1;
    sound.play();
}

function spawnFloatText() {
    const text = document.createElement("div");
    text.textContent = "+1";
    text.className = "float-text";

    document.body.appendChild(text);

    const rect = beanPic.getBoundingClientRect();
    text.style.left = (rect.left + rect.width / 2 + (Math.random() * 80 - 40)) + "px";
    text.style.top = (rect.top + (Math.random() * 60 - 30)) + "px";

    setTimeout(() => text.remove(), 800);
}

function initialize() {
    beanDisplay.textContent = beanAmount;
}

function devreset() {
    localStorage.setItem("beans", 0);
    beanAmount = localStorage.getItem("beans");
    beanDisplay.textContent = beanAmount;
}


/*--Events--*/

beanPic.addEventListener("click", beanclicker)

document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

bean.addEventListener('click', () => {
    bean.classList.remove('bean-clicked');
    void bean.offsetWidth;
    bean.classList.add('bean-clicked');
});

bean.addEventListener('animationend', () => {
  bean.classList.remove('bean-clicked');
});

/*--Start--*/

initialize();