const index = require("../index");
const fs = index.fs;
const say = index.say;
module.exports = function () {
    const funcStart = Date.now();
    const initcomps = {
        "X": "entity:controlRod",
        "O": "fluid:air",
        "A": "forge:storage_block/apatite",
        "Y": "forge:storage_block/cinnabar",
        "I": "forge:storage_blocks/iron",
        "M": "forge:storage_blocks/manasteel",
        "Q": "forge:storage_blocks/elementium",
        "N": "forge:storage_blocks/nickel",
        "L": "forge:storage_blocks/gold",
        "D": "forge:storage_blocks/diamond",
        "J": "forge:storage_blocks/netherite",
        "T": "forge:storage_blocks/terrasteel",
        "K": "forge:storage_blocks/emerald",
        "0": "forge:glass/colorless",
        "1": "forge:storage_blocks/copper",
        "B": "forge:storage_blocks/brass",
        "2": "forge:storage_blocks/osmium",
        "3": "forge:storage_blocks/refined_obsidian",
        "4": "forge:storage_blocks/refined_glowstone",
        "5": "forge:storage_blocks/bronze",
        "Z": "forge:storage_blocks/zinc",
        "U": "forge:storage_blocks/aluminum",
        "S": "forge:storage_blocks/steel",
        "V": "forge:storage_blocks/invar",
        "6": "forge:storage_blocks/tin",
        "7": "forge:storage_blocks/silver",
        "8": "forge:storage_blocks/signalum",
        "9": "forge:storage_blocks/lumium",
        "!": "forge:storage_blocks/lead",
        "@": "forge:storage_blocks/electrum",
        "P": "forge:storage_blocks/platinum",
        "#": "forge:storage_blocks/enderium",
        "G": "forge:storage_blocks/graphite",
        "$": "minecraft:ice",
        "%": "bigreactors:dry_ice",
        "C": "bigreactors:cryomisi",
        "^": "bigreactors:tangerium",
        "&": "bigreactors:redfrigium",
        "W": "minecraft:water",
        "*": "astralsorcery:liquid_starlight",
        "-": "bloodmagic:life_essence_fluid",
        "F": "mekanism:hydrofluoric_acid",
        "_": "mekanism:sodium",
        "H": "mekanism:hydrogen_chloride",
        "+": "mekanism:ethene",
        "E": "thermal:ender",
        "R": "thermal:redstone"
    }
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