const sharp = require("sharp");
const fs = require("fs");

for (let file of fs.readdirSync("../../../reactorsaves").filter(thing => !["current.json"].includes(thing))) {
    console.log(file);
}