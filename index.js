const fs = require("fs");
module.exports.fs = fs;
fs.mkdirSync("../../../reactorsaves", { recursive: true });
fs.mkdirSync("../../../reactorimagesaves", { recursive: true });
fs.mkdirSync("../../../reactorvars/compweights", { recursive: true });

const active_forms = new Map();
module.exports.active_forms = active_forms;

const contenders = new Map();
module.exports.contenders = contenders;

const max_forms = 2500;
module.exports.max_forms = max_forms;

const iterations = 1000000000;
module.exports.iterations = iterations;

const log_interval = parseInt(process.argv[2]); //interval to save a snapshot of active_forms in ./log/
module.exports.log_interval = log_interval;

const readout_level = process.argv[3];
module.exports.readout_level = readout_level;

const target_fuel_use = 430006/2.85; // [(RF/t) / (mB/t)]
module.exports.target_fuel_use = target_fuel_use;

const set_parameters = {
    "xSize": 32,
    "zSize": 32,
    "height": 20,
    "isActivelyCooled": false,
    "controlRodInsertion": 0
}
module.exports.set_parameters = set_parameters;

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
    //"*": "astralsorcery:liquid_starlight",
    //"-": "bloodmagic:life_essence_fluid",
    "F": "mekanism:hydrofluoric_acid",
    "_": "mekanism:sodium",
    "H": "mekanism:hydrogen_chloride",
    "+": "mekanism:ethene",
    "E": "thermal:ender",
    "R": "thermal:redstone"
}
module.exports.initcomps = initcomps;

module.exports.say = require("./bigsim_modules/say");

const buildComponents = require("./bigsim_modules/buildComps");
module.exports.buildComponents = buildComponents;

const components = buildComponents();
module.exports.components = components;

let init_iteration = 1;
module.exports.init_iteration = init_iteration;

const utils = require("./bigsim_modules/utils");
module.exports.utils = utils;

const startupArt = require("./bigsim_modules/startupArt");
const main = require("./bigsim_modules/main");

startupArt();
main();