const fs = require("fs");
const bent = require("bent");
const getJSON = bent("json");
const apiurls = process.argv[2].split(",");
let aggrocalls = 0;
const active_forms = {};
// "configuration string":{"stats":{}, "age":0}
const max_forms = 10;
const iterations = 10000000;
const log_interval = 100; //interval to save a snapshot of active_forms in ./log/
fs.mkdirSync("./log", { recursive: true });
// https://br.sidoh.org/api/simulate?definition=%7B%22xSize%22%3A15%2C%22zSize%22%3A15%2C%22height%22%3A15%2C%22layout%22%3A%22XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX%22%2C%22isActivelyCooled%22%3Afalse%2C%22controlRodInsertion%22%3A0%7D
const set_parameters = {
    "xSize": 15,
    "zSize": 15,
    "height": 15,
    "isActivelyCooled": false,
    "controlRodInsertion": 0
}

const fitness_weights = {
    "output": 1,
    "fuelConsumption": 0.1
}

const components = { "C": "Gelid Cryotheum", "E": "Liquid Ender", "D": "Diamond Block", "G": "Graphite Block", "R": "Destabilized Redstone", "X": "Control Rod", "L": "Block of Gold", "O": "Air" }

const seed = "X".repeat((set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2));

function make_permutation(parent_configuration) {
    let pos = Math.round(Math.random() * (parent_configuration.length - 1));
    let insert = Object.keys(components)[Math.round(Math.random() * (Object.keys(components).length - 1))];
    let configuration = parent_configuration.replaceAt(pos, insert);
    return configuration;
}

const n = 10;
async function get_stats(configuration) {
    let samples = [];
    for (let i = 0; i < n; i++) {
        console.log("getting stats " + i);
        let thisdef = {};
        Object.assign(thisdef, set_parameters);
        thisdef["layout"] = configuration;
        samples.push(await givemetheresultalready(apiurls[allcalls % apiurls.length] + "?definition=" + encodeURIComponent(JSON.stringify(thisdef))));
    }
    let keys_to_stat = ["coolantTemperature", "fuelConsumption", "fuelFertility", "fuelHeat", "output", "reactorHeat"];
    let results = {};
    for (let key of keys_to_stat) {
        results[key] = {};
        let min = Infinity;
        let max = -Infinity;
        let sum = 0;
        for (let sample of samples) {
            sum = sum + sample[key];
            if (sample[key] < min) {
                min = sample[key];
            }
            if (sample[key] > max) {
                max = sample[key];
            }
        }
        let avg = sum / n;
        let stdevsum = 0;
        for (let sample of samples) {
            stdevsum = stdevsum + Math.pow((sample[key] - avg), 2);
        }
        console.log("stdevsum:" + stdevsum);
        let stdev = Math.sqrt(stdevsum / n);
        console.log("stdev:" + stdev);
        results[key]["min"] = min;
        results[key]["max"] = max;
        results[key]["avg"] = avg;
        results[key]["stdev"] = stdev;
    }
    return results;
}

String.prototype.replaceAt = function (index, replacement) {
    return this.substring(0, index) + replacement + this.substring(index + replacement.length);
}

function get_weakest_form() {
    let lowest_score = Infinity;
    let lowest_score_configuration = "";
    let highest_score = -Infinity;
    let highest_score_configuration = "";
    for (let configuration of Object.keys(active_forms)) {
        let form = active_forms[configuration];
        let score = 0;
        for (let key of Object.keys(fitness_weights)) {
            score = score + fitness_weights[key] * form["stats"][key]["avg"];
        }
        console.log("score:" + score);
        if (score < lowest_score) {
            lowest_score = score;
            lowest_score_configuration = configuration;
        }
        if (score > highest_score) {
            highest_score = score;
            highest_score_configuration = configuration;
        }
    }
    console.log(JSON.stringify(highest_score_configuration));
    console.log(JSON.stringify(lowest_score_configuration));
    if (highest_score_configuration != "") {
        console.log("Topstats:");
        console.log("    Gen:" + (Math.round(active_forms[highest_score_configuration]["stats"]["output"]["avg"] * 100) / 100) + "+-" + (Math.round(active_forms[highest_score_configuration]["stats"]["output"]["stdev"] * 100) / 100) + " RF/t");
        console.log("    Eat:" + (Math.round(active_forms[highest_score_configuration]["stats"]["fuelConsumption"]["avg"] * 100) / 100) + "+-" + (Math.round(active_forms[highest_score_configuration]["stats"]["fuelConsumption"]["stdev"] * 100) / 100) + " mB/t");
    }
    return lowest_score_configuration;
}

ii = 1;
const starttime = Date.now();
async function main() {
    for (ii = 1; ii < iterations + 1; ii++) {
        let weakest = get_weakest_form();
        if (Object.keys(active_forms).length >= max_forms) {
            delete active_forms[weakest];
        }
        let whatareyoudoing;
        if (Object.keys(active_forms).length == 0) {
            whatareyoudoing = seed;
        } else {
            whatareyoudoing = Object.keys(active_forms)[Math.ceil(Math.random() * (Object.keys(active_forms).length - 1))];
        }
        console.log(whatareyoudoing);
        let new_configuration = make_permutation(whatareyoudoing);
        active_forms[new_configuration] = { "age": 0 };
        active_forms[new_configuration]["stats"] = await get_stats(new_configuration);

        if (ii % log_interval == 0) {
            fs.writeFileSync("./log/" + ii + ".json", JSON.stringify(active_forms, null, 4), { encoding: false });
        }
        fs.writeFileSync("./log/current.json", JSON.stringify(active_forms, null, 4), { encoding: false });

        for (let configuration of Object.keys(active_forms)) {
            active_forms[configuration]["age"]++;
        }
    }
    fs.writeFileSync("./log/final.json", JSON.stringify(active_forms, null, 4), { encoding: false });
}


let allcalls = 0;
let errorcalls = 0;
async function givemetheresultalready(url) {
    let complete = false;
    let tries = 0;
    let result = {};
    let thiscall = aggrocalls % n + 1;
    aggrocalls++;
    while (complete == false) {
        await sleep(Math.floor((1200 + Math.random() * 750) / apiurls.length));
        tries++;
        try {
            let time_elapsed = (Date.now() - starttime) / 60000;
            let progress_made = ii * n + thiscall;
            let speed = progress_made / time_elapsed;
            let remaining = Math.floor(((iterations - ii) * n + thiscall) / speed);
            console.log("{" + ii + "/" + iterations + "}[" + thiscall + "/" + n + "](x" + tries + ") Making a call... (ETA: " + remaining + " minutes) [" + Math.round(((ii * n + thiscall) / (iterations * n)) * 1000) / 100 + "% progress] {" + Math.round((errorcalls / allcalls) * 1000) / 100 + "% fail rate}");
            allcalls++;
            result = await getJSON(url);
            complete = true;
        } catch (err) {
            errorcalls++;
            console.log("{" + ii + "/" + iterations + "}[" + thiscall + "/" + n + "](x" + tries + ") Keep trying. <" + err.toString() + ">");
            complete = false;
        }
    }
    return result;
}

async function sleep(ms) {
    console.log("ZzZZz... (" + ms + "ms)");
    return new Promise(resolve => setTimeout(resolve, ms));
}
main();