import Labyrinth from "./labyrint.mjs"
import SplashScreen from "./splashScreen.mjs";
import ANSI from "./utils/ANSI.mjs";

const REFRESH_RATE = 250;

console.log(ANSI.RESET, ANSI.CLEAR_SCREEN, ANSI.HIDE_CURSOR);

let intervalID = null;
let isBlocked = false;
let state = null;

function startGame() {
    
    const splash = new SplashScreen(); 

    splash.animate(() => {
    state = new Labyrinth(() => clearInterval(intervalID));
    intervalID = setInterval(update, REFRESH_RATE);
    });
}

function update() {

    if (isBlocked) { return; }
    isBlocked = true;
    state.update();
    state.draw();
    isBlocked = false;
}

startGame();