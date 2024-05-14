const index = require("../index");
const fs = index.fs;
const say = index.say;
const initcomps = index.initcomps;
module.exports = function () {
    const funcStart = Date.now();
    for (let compkey of Object.keys(initcomps)) {
        initcomps[compkey] = { "name": initcomps[compkey], "weight": 1 };
    }
    if (fs.existsSync("../../../reactorvars/compweights/current.json")) {
        const oldcompweights = JSON.parse(fs.readFileSync("../../../reactorvars/compweights/current.json"));
        for (let compkey of Object.keys(initcomps)) {
            initcomps[compkey]["weight"] = oldcompweights[compkey]["weight"];
        }
    }
    say(`buildComponents() [${Date.now() - funcStart} ms]`);
    return initcomps;
}