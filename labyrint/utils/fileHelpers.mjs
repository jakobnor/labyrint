import fs from 'fs';

function readRecordFile(fileName) {
    let data = fs.readFileSync(fileName, { encoding: "utf8" });
    return data.split(/\r?\n/); 
}

function readMapFile(fileName) {
    let data = fs.readFileSync(fileName, { encoding: "utf8" });
    let lines = data.split(/\r?\n/); 
    let map = lines.map(line => line.split(''));
    return map;
}

export { readRecordFile, readMapFile };
