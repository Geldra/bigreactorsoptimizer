const fs = require("fs");
module.exports.fs = fs;
fs.mkdirSync("../../../reactorsaves", { recursive: true });
fs.mkdirSync("../../../reactorimagesaves", { recursive: true });
fs.mkdirSync("../../../reactorvars/compweights", { recursive: true });

const active_forms = new Map();
module.exports.active_forms = active_forms;

const max_forms = 800;
module.exports.max_forms = max_forms;

const iterations = 1000000000;
module.exports.iterations = iterations;

const log_interval = parseInt(process.argv[2]); //interval to save a snapshot of active_forms in ./log/
module.exports.log_interval = log_interval;

const readout_level = process.argv[3];
module.exports.readout_level = readout_level;

const set_parameters = {
    "xSize": 30,
    "zSize": 30,
    "height": 5,
    "isActivelyCooled": false,
    "controlRodInsertion": 0
}
module.exports.set_parameters = set_parameters;

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