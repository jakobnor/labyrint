import Labyrinth from "./labyrint.mjs";
import ANSI from "./utils/ANSI.mjs";
import SplashScreen from "./splashScreen.mjs";

const REFRESH_RATE = 250;

console.log(ANSI.RESET, ANSI.CLEAR_SCREEN, ANSI.HIDE_CURSOR);

let intervalID = null;
let isBlocked = false;
let state = null;

async function init() {
    
    const splash = new SplashScreen();
    await splash.show();

    
    state = new Labyrinth();
    intervalID = setInterval(update, REFRESH_RATE);
}

function update() {
    if (isBlocked) { return; }
    isBlocked = true;

    
    state.update();
    state.draw();

    isBlocked = false;
}

init();
