import ANSI from "./utils/ANSI.mjs";
import KeyBoardManager from "./utils/KeyBoardManager.mjs";
import { readMapFile, readRecordFile } from "./utils/fileHelpers.mjs";
import * as CONST from "./constants.mjs";

const startingLevel = CONST.START_LEVEL_ID;
const levels = loadLevelListings();
const levelHistory = [];
const DOOR_MAPPINGS = {
    "start": { "D": { targetRoom: "aSharpPlace", targetDoor: "D" } },
    "aSharpPlace": { "D": { targetRoom: "start", targetDoor: "D" } }
}


function loadLevelListings(source = CONST.LEVEL_LISTING_FILE) {
    let data = readRecordFile(source);
    let levels = {};
    for (const item of data) {
        let keyValue = item.split(":");
        if (keyValue.length >= 2) {
            let key = keyValue[0];
            let value = keyValue[1];
            levels[key] = value;
        }
    }
    return levels;
}

let pallet = {
    "█": ANSI.COLOR.LIGHT_GRAY,
    "H": ANSI.COLOR.RED,
    "$": ANSI.COLOR.YELLOW,
    "B": ANSI.COLOR.GREEN,
}


let isDirty = true;

let playerPos = {
    row: null,
    col: null,
}

const EMPTY = " ";
const HERO = "H";
const LOOT = "$"

const THINGS = [LOOT, EMPTY];

let eventText = "";

const HP_MAX = 10;

const playerStats = {
    hp: 8,
    chash: 0
}

class Labyrinth {
    constructor() {
        this.npcs = [];
        this.lastDoorSymbol = null;
        this.loadLevel(startingLevel);
    }

    loadLevel(levelID, fromDoor = null) {
        if (this.levelID) {
            const currentDoor = this.level[playerPos.row][playerPos.col];
            levelHistory.push({
                levelID: this.levelID,
                playerPos: { ...playerPos },
                lastDoor: currentDoor,
            })
        }
        this.levelID = levelID;
        this.level = readMapFile(levels[levelID]);

        if (fromDoor) {
            const doorLocation = this.findSymbol(fromDoor);
            if (doorLocation) {
                this.level[doorLocation.row][doorLocation.col];
                playerPos.row = doorLocation.row;
                playerPos.col = doorLocation.col;

            } else if (levelID === "start") {
                const startingRow = 5;
                const startingCol = 4;
                this.level[startingRow][startingCol] = HERO;
                playerPos.row = startingRow;
                playerPos.col = startingCol;
            }
            this.level[playerPos.row][playerPos.col] = HERO;
            isDirty = true;
        }
    }

    returnToPrev() {
        if (levelHistory.length === 0) return;

        const { levelID, playerPos: savedPos, lastDoor } = levelHistory.pop();

        this.levelID = levelID;
        this.level = readMapFile(levels[levelID]);

        this.level[savedPos.row][savedPos.col] = HERO;
        playerPos.row = savedPos.row;
        playerPos.col = savedPos.col;

        const currentDoor = this.lastDoorSymbol || EMPTY;
        this.level[playerPos.row][playerPos.col] = currentDoor;
        isDirty = true;
    }

    update() {

        if (KeyBoardManager.isQuitPressed()) {
            process.exit();
        }

        if (playerPos.row === null || playerPos.col === null) {
            for (let row = 0; row < this.level.length; row++) {
                for (let col = 0; col < this.level[row].length; col++) {
                    if (this.level[row][col] == HERO) {
                        playerPos.row = row;
                        playerPos.col = col;
                        break;
                    }
                }
                if (playerPos.row != undefined) {
                    break;
                }
            }
        }

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
        let tcol = playerPos.col + dcol;

        if (tRow < 0 || tcol < 0 || tRow >= this.level.length || tcol >= this.level[0].length) return;

        const targetCell = this.level[tRow][tcol];

        console.log(THINGS.includes(targetCell));

        if (THINGS.includes(targetCell)) {
            if (targetCell == LOOT) {
                let loot = Math.round(Math.random() * 7) + 3;
                playerStats.chash += loot;
                eventText = `Player gained ${loot}$`;
            }

            if (this.level[playerPos.row][playerPos.col] === HERO && this.lastDoorSymbol) {
                this.level[playerPos.row][playerPos.col] = this.lastDoorSymbol;
                this.lastDoorSymbol = null;
            } else {
                this.level[playerPos.row][playerPos.col] = EMPTY;
            }


            this.level[tRow][tcol] = HERO;

            playerPos.row = tRow;
            playerPos.col = tcol;


            isDirty = true;
        } else if (targetCell === "D" || targetCell === "d") {

            let tempHeroCoords = this.getEntityCoordinates(HERO);

            if (tempHeroCoords) {
                this.removeEntity(tempHeroCoords.x, tempHeroCoords.y);
            }

            const currentRoom = this.levelID;
            const doorMapping = DOOR_MAPPINGS[currentRoom][targetCell];

            if (doorMapping) {
                this.lastDoorSymbol = targetCell;
                this.loadLevel(doorMapping.targetRoom, doorMapping.targetDoor);
            }


        } else if (targetCell === "\u2668") {
            const otherTeleport = this.findSecondTeleport(tRow, tcol);
            if (otherTeleport) {
                this.level[playerPos.row][playerPos.col] = "\u2668";
                playerPos.row = otherTeleport.row;
                playerPos.col = otherTeleport.col;
                this.level[playerPos.row][playerPos.col] = HERO;
                eventText = "Teleported!";
                isDirty = true;
            }
        }

        this.npcs.forEach((npc) => {
            let nextCol = npc.col = npc.direction;

            if (
                nextCol < 0 ||
                nextCol >= this.level[0].length ||
                this.level[npc.row][nextCol] !== EMPTY
            ) {
                npc.direction *= -1;
            } else {
                this.level[npc.row][npc.col] = EMPTY;
                this.col += npc.direction;
                this.level[npc.row][npc.col] = "X";

            }
        });
        isDirty = true;
    }



    getEntityAt(x, y) {
        return this.level[y][x];
    }

    removeEntity(x, y) {
        this.level[y][x] = EMPTY;
    }

    getHeroPosition() {
        return getEntityCoordinates(HERO);
    }

    getEntityCoordinates(entity) {
        for (let y = 0; y < this.level.length; y++) {
            for (let x = 0; x < this.level[y].length; x++) {
                if (this.level[y][x] === entity) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    findSecondTelepor() {
        for (let row = 0; row < this.level.length; row++) {
            for (let col = 0; col < this.level[row].length; col++) {
                if (this.level[row][col] === "\u2668") {
                    return { row, col };
                }
            }
        }
        return null;
    }


    findSymbol(symbol) {
        for (let row = 0; row < this.level.length; row++) {
            for (let col = 0; col < this.level[row].length; col++) {
                if (this.level[row][col] === symbol) {
                    return { row, col };
                }
            }
        }
        return null;
    }



    draw() {

        if (isDirty == false) {
            return;
        }
        isDirty = false;

        console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);

        let rendring = "";

        rendring += renderHud();

        for (let row = 0; row < this.level.length; row++) {
            let rowRendering = "";
            for (let col = 0; col < this.level[row].length; col++) {
                let symbol = this.level[row][col];
                if (pallet[symbol] != undefined) {
                    rowRendering += pallet[symbol] + symbol + ANSI.COLOR_RESET;
                } else {
                    rowRendering += symbol;
                }
            }
            rowRendering += "\n";
            rendring += rowRendering;
        }

        console.log(rendring);
        if (eventText != "") {
            console.log(eventText);
            eventText = "";
        }
    }
}


function renderHud() {
    let hpBar = `Life:[${ANSI.COLOR.RED + pad(playerStats.hp, "♥︎") + ANSI.COLOR_RESET}${ANSI.COLOR.LIGHT_GRAY + pad(HP_MAX - playerStats.hp, "♥︎") + ANSI.COLOR_RESET}]`
    let cash = `$:${playerStats.chash}`;
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