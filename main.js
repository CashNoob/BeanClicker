let beanAmount = 0;
let beanDisplay = document.getElementById("beans");
let beanPic = document.getElementById("beanpic");

/*--Functions--*/

function beanclicker() {
    beanAmount++;
    beanDisplay.textContent = beanAmount;
}






/*--Listeners--*/

beanPic.addEventListener("click", beanclicker)