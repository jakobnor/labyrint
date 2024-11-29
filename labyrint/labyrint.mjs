import ANSI from "./utils/ANSI.mjs";
import KeyBoardManager from "./utils/KeyBoardManager.mjs";
import { readMapFile, readRecordFile } from "./utils/fileHelpers.mjs";
import * as CONST from "./constants.mjs";

const startingLevel = CONST.START_LEVEL_ID;
const levels = loadLevelListings();

function loadLevelListings(source = CONST.LEVEL_LISTING_FILE) {
    let data = readRecordFile(source);
    let levels = {};
    for (const item of data) {
        let trimmedItem = item.trim();
        let keyValue = trimmedItem.split(":");
        if (keyValue.length >= 2) {
            let key = keyValue[0].trim();
            let value = keyValue[1].trim();
            levels[key] = value;
        }
    }
    return levels;
}

let currentLevelName = startingLevel;
let levelData = readMapFile(CONST.MAP_DIRECTORY + levels[currentLevelName]);
let level = levelData;

let palette = {
    [CONST.WALL]: ANSI.COLOR.LIGHT_GRAY,
    [CONST.HERO]: ANSI.COLOR.RED,
    [CONST.LOOT]: ANSI.COLOR.YELLOW,
    "B": ANSI.COLOR.GREEN,
    [CONST.DOOR]: ANSI.COLOR.WHITE,
    [CONST.TELEPORT]: ANSI.COLOR.CYAN,
    [CONST.NPC]: ANSI.COLOR.GREEN,
    [CONST.HEALTH_POTION]: ANSI.COLOR.GREEN,
    [CONST.POISON]: ANSI.COLOR.MAGENTA,
    [CONST.SPECIAL_ITEM]: ANSI.COLOR.YELLOW, 
};

let isDirty = true;

let playerPos = {
    row: null,
    col: null,
};

let items = [];
let teleporters = [];
let npcs = [];
let levelStack = [];

const THINGS = [
    CONST.LOOT,
    CONST.EMPTY,
    CONST.HEALTH_POTION,
    CONST.POISON,
    CONST.SPECIAL_ITEM, 
];

let eventQueue = []; 

const HP_MAX = 10;

const playerStats = {
    hp: 8,
    strength: 2,
    cash: 0,
};

class Labyrinth {
    constructor() {
        this.loadLevel(currentLevelName);
    }

    loadLevel(levelName, entryPosition = null) {
        currentLevelName = levelName;
        levelData = readMapFile(CONST.MAP_DIRECTORY + levels[currentLevelName]);
        level = levelData;
        isDirty = true;

        
        playerPos = { row: null, col: null };
        teleporters = [];
        npcs = [];

        
        for (let row = 0; row < level.length; row++) {
            for (let col = 0; col < level[row].length; col++) {
                let tile = level[row][col];
                if (tile === CONST.HERO) {
                    playerPos.row = row;
                    playerPos.col = col;
                } else if (tile === CONST.TELEPORT) {
                    teleporters.push({ row, col });
                } else if (tile === CONST.NPC) {
                    npcs.push({
                        row,
                        col,
                        startCol: col,
                        direction: 1,
                        hp: 3,
                        strength: 1,
                    });
                }
            }
        }

        
        if (entryPosition) {
            
            if (playerPos.row !== null && playerPos.col !== null) {
                level[playerPos.row][playerPos.col] = CONST.EMPTY;
            }
            playerPos.row = entryPosition.row;
            playerPos.col = entryPosition.col;
            level[playerPos.row][playerPos.col] = CONST.HERO;
        }
    }

    update() {
        let drow = 0;
        let dcol = 0;

        if (KeyBoardManager.isUpPressed()) {
            drow = -1;
        } else if (KeyBoardManager.isDownPressed()) {
            drow = 1;
        }

        if (KeyBoardManager.isLeftPressed()) {
            dcol = -1;
        } else if (KeyBoardManager.isRightPressed()) {
            dcol = 1;
        }

        let tRow = playerPos.row + drow;
        let tCol = playerPos.col + dcol;

        let currentTile = level[tRow][tCol];

        if (currentTile === CONST.WALL) {
            return;
        }

        if (currentTile === CONST.DOOR) {
            
            if (currentLevelName === 'start') {
                
                levelStack.push({
                    levelName: currentLevelName,
                    position: { row: playerPos.row, col: playerPos.col },
                });
                this.loadLevel('aSharpPlace');
            } else if (currentLevelName === 'aSharpPlace') {
                
                levelStack.push({
                    levelName: currentLevelName,
                    position: { row: playerPos.row, col: playerPos.col },
                });
                this.loadLevel('thirdLevel');
            } else if (currentLevelName === 'thirdLevel') {
                
                if (levelStack.length > 0) {
                    let previousLevel = levelStack.pop();
                    this.loadLevel(previousLevel.levelName, previousLevel.position);
                } else {
                    
                    this.loadLevel('aSharpPlace');
                }
            }
            return;
        }

        if (currentTile === CONST.TELEPORT) {
            if (teleporters.length >= 2) {
                let otherTeleporter = teleporters.find(tp => tp.row !== tRow || tp.col !== tCol);
                if (otherTeleporter) {
                    level[playerPos.row][playerPos.col] = CONST.EMPTY;
                    playerPos.row = otherTeleporter.row;
                    playerPos.col = otherTeleporter.col;
                    level[playerPos.row][playerPos.col] = CONST.HERO;
                    isDirty = true;
                    return;
                }
            }
        }

        if (currentTile === CONST.NPC) {
            
            let npc = npcs.find(n => n.row === tRow && n.col === tCol);
            if (npc) {
                
                npc.hp -= playerStats.strength;
                playerStats.hp -= npc.strength;
                eventQueue.push({ text: `You hit the enemy! Enemy HP: ${npc.hp}`, duration: 3 });
                eventQueue.push({ text: `Enemy hits you! Your HP: ${playerStats.hp}`, duration: 3 });

                
                if (npc.hp <= 0) {
                    level[npc.row][npc.col] = CONST.EMPTY;
                    npcs = npcs.filter(n => n !== npc);
                    eventQueue.push({ text: "Enemy defeated!", duration: 3 });
                }

                
                if (playerStats.hp <= 0) {
                    eventQueue.push({ text: "You have been defeated!", duration: 3 });
                    this.gameOver();
                }

                isDirty = true;
                return; 
            }
        }

        if (THINGS.includes(currentTile)) {
            if (currentTile === CONST.LOOT) {
                let loot = Math.round(Math.random() * 7) + 3;
                playerStats.cash += loot;
                eventQueue.push({ text: `Player gained ${loot}$`, duration: 3 });
            } else if (currentTile === CONST.HEALTH_POTION) {
                playerStats.hp = Math.min(playerStats.hp + 3, HP_MAX);
                eventQueue.push({ text: "You picked up a health potion! +3 HP", duration: 3 });
            } else if (currentTile === CONST.POISON) {
                playerStats.hp -= 2;
                eventQueue.push({ text: "You picked up poison! -2 HP", duration: 3 });
                if (playerStats.hp <= 0) {
                    eventQueue.push({ text: "You have been poisoned and died!", duration: 3 });
                    this.gameOver();
                }
            } else if (currentTile === CONST.SPECIAL_ITEM) {
                eventQueue.push({ text: "You found the legendary artifact!", duration: 3 });
                this.winGame();
                return;
            }

            
            level[playerPos.row][playerPos.col] = CONST.EMPTY;
            level[tRow][tCol] = CONST.HERO;

            
            playerPos.row = tRow;
            playerPos.col = tCol;

            isDirty = true;
        } else {
            
            level[playerPos.row][playerPos.col] = CONST.EMPTY;
            level[tRow][tCol] = CONST.HERO;

            
            playerPos.row = tRow;
            playerPos.col = tCol;

            isDirty = true;
        }

        
        for (let npc of npcs) {
            let nextCol = npc.col + npc.direction;

            
            if (
                Math.abs(nextCol - npc.startCol) > 2 ||
                level[npc.row][nextCol] === CONST.WALL ||
                level[npc.row][nextCol] === CONST.NPC ||
                level[npc.row][nextCol] === CONST.DOOR
            ) {
                
                npc.direction *= -1;
                nextCol = npc.col + npc.direction;
            }

            
            if (level[npc.row][nextCol] === CONST.HERO) {
                
                playerStats.hp -= npc.strength;
                eventQueue.push({ text: `An enemy hits you! Your HP: ${playerStats.hp}`, duration: 3 });
                if (playerStats.hp <= 0) {
                    eventQueue.push({ text: "You have been defeated!", duration: 3 });
                    this.gameOver();
                }
            } else {
                
                level[npc.row][npc.col] = CONST.EMPTY; 
                npc.col = nextCol;
                level[npc.row][npc.col] = CONST.NPC; 
            }
        }
    }

    draw() {
        if (!isDirty) {
            return;
        }
        isDirty = false;

        console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);

        let rendering = "";

        rendering += renderHud();

        
        for (let row = 0; row < level.length; row++) {
            let rowRendering = "";
            for (let col = 0; col < level[row].length; col++) {
                let symbol = level[row][col];
                if (palette[symbol] != undefined) {
                    rowRendering += palette[symbol] + symbol + ANSI.COLOR_RESET;
                } else {
                    rowRendering += symbol;
                }
            }
            rowRendering += "\n";
            rendering += rowRendering;
        }

        console.log(rendering);

        
        if (eventQueue.length > 0) {
            for (let event of eventQueue) {
                console.log(event.text);
                event.duration -= 1;
            }
            
            eventQueue = eventQueue.filter(event => event.duration > 0);
        }
    }

    gameOver() {
        console.log(ANSI.RESET, ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
        console.log("Game Over! You have been defeated.");
        process.exit();
    }

    winGame() {
        console.log(ANSI.RESET, ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
        console.log("Congratulations! You have found the legendary artifact and won the game!");
        process.exit();
    }
}

function renderHud() {
    let hpBar = `Life:[${ANSI.COLOR.RED + pad(playerStats.hp, "♥︎")}${ANSI.COLOR_RESET}${ANSI.COLOR.LIGHT_GRAY + pad(HP_MAX - playerStats.hp, "♥︎")}${ANSI.COLOR_RESET}]`;
    let cash = `$:${playerStats.cash}`;
    return `${hpBar} ${cash}\n`;
}

function pad(len, text) {
    let output = "";
    for (let i = 0; i < len; i++) {
        output += text;
    }
    return output;
}

export default Labyrinth;
