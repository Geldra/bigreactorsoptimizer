const fs = require("fs");
const bent = require("bent");
const post = bent("http://localhost:8081/", "POST", "json", 200);
var active_forms = {};
// "configuration string":{"stats":{}, "age":0}
const max_forms = 200;
const iterations = 100000000;
const log_interval = parseInt(process.argv[2]); //interval to save a snapshot of active_forms in ./log/
fs.mkdirSync("../../../reactorsaves", { recursive: true });
fs.mkdirSync("../../../reactorimagesaves", { recursive: true });
fs.mkdirSync("../../../reactorvars/compweights", { recursive: true });
const readout_level = process.argv[3];

const set_parameters = {
    "xSize": 32,
    "zSize": 32,
    "height": 5,
    "isActivelyCooled": false,
    "controlRodInsertion": 0
}

const components = buildComponents();
function buildComponents() {
    const funcStart = Date.now();
    const initcomps = { "C": "Gelid Cryotheum", "E": "Liquid Ender", "D": "Diamond Block", "G": "Graphite Block", "R": "Destabilized Redstone", "X": "Control Rod", "L": "Block of Gold", "O": "Air" }
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

let init_iteration = 1;
const seed = buildrandomseed();

function buildrandomseed() {
    const funcStart = Date.now();
    if (fs.existsSync("../../../reactorsaves/current.json")) {
        let highest_iteration = 1;
        for (let file of fs.readdirSync("../../../reactorsaves").filter(ifile => ![".", "..", "current.json"].includes(ifile))) {
            let new_num = parseInt(file.replace(".json", ""));
            if (new_num > highest_iteration) {
                highest_iteration = new_num;
            }
        }
        init_iteration = highest_iteration;
        let import_forms = JSON.parse(fs.readFileSync("../../../reactorsaves/current.json"));
        for (let key of Object.keys(import_forms)) {
            active_forms[key] = import_forms[key];
        }
        say("Imported from file", "normal");
    }
    let newseed = "";
    for (let i = 0; i < (set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2); i++) {
        newseed = newseed + "X";
    }
    say(`buildrandomseed() [${Date.now() - funcStart} ms]`);
    return newseed;
}

function make_permutation(parent_configuration, mutations_left) {
    const funcStart = Date.now();
    let configuration = parent_configuration;
    let changes = {};
    let tiles = [];
    let tile_weights = []; //cumulative weights
    for (let tile of Object.keys(components)) {
        tiles.push(tile);
        tile_weights.push(tile_weights.reduce((a, b) => a + b, 1) + components[tile]["weight"]);
    }
    //normalize weights
    for (let i = 0; i < tile_weights.length; i++) {
        tile_weights[i] = tile_weights[i] / tile_weights[tile_weights.length - 1];
    }
    while (mutations_left > 0) {
        let pos = Math.round(Math.random() * (parent_configuration.length - 1));
        //let insert = Object.keys(components)[Math.round(Math.random() * (Object.keys(components).length - 1))];
        let insert = tiles[tiles.length - 1];
        let insertrand = Math.random();
        for (let i = 0; i < tile_weights.length; i++) {
            if (insertrand < tile_weights[i]) {
                insert = tiles[i];
                break;
            }
        }
        configuration = parent_configuration.replaceAt(pos, insert);
        if (Object.keys(changes).includes(insert)) {
            changes[insert] = changes[insert] + 1;
        } else {
            changes[insert] = 1;
        }
        mutations_left--;
    }
    say(`make_permutation() [${Date.now() - funcStart} ms]`);
    return [configuration, changes];
}

const n = 3;
async function get_stats(configuration) {
    const funcStart = Date.now();
    let samples = [];
    for (let i = 0; i < n; i++) {
        let thisdef = {};
        Object.assign(thisdef, set_parameters);
        thisdef["layout"] = configuration;
        samples.push(givemetheresultalready(thisdef));
    }
    samples = await Promise.all(samples);
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
        let stdev = Math.sqrt(stdevsum / n);
        results[key]["min"] = min;
        results[key]["max"] = max;
        results[key]["avg"] = avg;
        results[key]["stdev"] = stdev;
    }
    say(`get_stats() [${Date.now() - funcStart} ms]`);
    return results;
}

String.prototype.replaceAt = function (index, replacement) {
    return this.substring(0, index) + replacement + this.substring(index + replacement.length);
}

ii = 1;
const starttime = Date.now();
var loggedinit = false;
var last_highest = [];
var highest_conf = "";
const max_last_highest = 10; //higher numbers here make it less sensitive to changes
const convergence_percent_error_threshold = 0.0002;
var convergence_detection_count = 0;
const convergence_detection_count_threshold = 500; //number of times to try escaping the local optimum
const max_breakouts = 10; //blank resets to reconverge
let breakouts = 0;
async function main() {
    for (ii = init_iteration; ii < iterations + 1; ii++) {
        let stacktrace_iter = [];
        const old_highest_conf = highest_conf;
        const old_highest_score = Object.keys(active_forms).includes(old_highest_conf) ? active_forms[old_highest_conf]["stats"]["output"]["avg"] : 0;
        stacktrace_iter.push(["old_highest_conf165", old_highest_conf + "-" + old_highest_score]);
        //Check if convergence has been reached
        if (convergence_detection_count > convergence_detection_count_threshold) {
            say("Convergence detected.", "sparse");
            if (breakouts < max_breakouts) {
                //Breakout
                say(`Attempting convergence breakout... (${breakouts}/${max_breakouts})`, "sparse");
                let newseed = "";
                for (let i = 0; i < (set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2); i++) {
                    newseed = newseed + "X";
                }
                active_forms = {};
                active_forms[newseed] = { "age": 0 };
                active_forms[newseed]["stats"] = await get_stats(newseed);
                active_forms[newseed]["ancestor"] = "";

                breakouts = breakouts + 1;
            } else {
                //End on max breakouts
                say("No more breakouts. Convergence results:", "sparse");
                const highest_stats = active_forms[highest_conf]["stats"];
                for (let key of Object.keys(highest_stats)) {
                    say("   " + key + "= " + highest_stats[key]["avg"] + " +- " + highest_stats[key]["stdev"], "sparse");
                }
                break;
            }
        }
        const startitertime = Date.now();
        //Recording a set of samples for standard deviation calc
        if (Object.keys(active_forms).length > 0) {
            let highest = Object.keys(active_forms).sort((a, b) => {
                return active_forms[a]["stats"]["output"]["avg"] - active_forms[b]["stats"]["output"]["avg"];
            });
            stacktrace_iter.push(["highest", arrmapstack(highest)]);
            last_highest.push(active_forms[highest[highest.length - 1]]["stats"]["output"]["avg"]);
            highest = null;
            if (last_highest.length > max_last_highest) {
                last_highest = last_highest.slice(1);
            }
        }
        //Culling
        for (let j = 0; j < Math.ceil(Math.random() * max_forms); j++) {
            if (Object.keys(active_forms).length >= max_forms / 3) { //prevent population from dropping too much (/shouldn't/ be needed after startup)
                let weakest_arr = Object.keys(active_forms).sort((a, b) => {
                    return active_forms[a]["stats"]["output"]["avg"] - active_forms[b]["stats"]["output"]["avg"];
                });
                stacktrace_iter.push(["weakest_arr213-" + j, arrmapstack(weakest_arr)]);
                highest_conf = weakest_arr[weakest_arr.length - 1];
                stacktrace_iter.push(["highest_conf215-" + j, highest_conf + "-" + active_forms[highest_conf]["stats"]["output"]["avg"]]);
                if (old_highest_conf.length > 0) {
                    if (Object.keys(active_forms).includes(old_highest_conf)) {
                        if (active_forms[highest_conf]["stats"]["output"]["avg"] < active_forms[old_highest_conf]["stats"]["output"]["avg"]) {
                            //nonsense situation where highest is not the highest.
                            fs.writeFileSync("../../../whywhywhywhy" + Date.now() + ".json", JSON.stringify(
                                [[highest_conf, active_forms[highest_conf]["stats"]["output"]["avg"]], [old_highest_conf, active_forms[old_highest_conf]["stats"]["output"]["avg"]]]
                                , null, 4), { encoding: "utf-8" });
                        }
                    }
                }
                weakest_arr = weakest_arr.slice(0, Math.floor(weakest_arr.length / 10));
                stacktrace_iter.push(["weakest_arr225-" + j, arrmapstack(weakest_arr)]);
                let weakest = weakest_arr[Math.floor(Math.random() * weakest_arr.length)];
                stacktrace_iter.push(["weakest227-" + j, weakest + "-" + active_forms[weakest]["stats"]["output"]["avg"]]);
                say(`Culling checkstack:`, "debug");
                say(`   1: ${active_forms[weakest_arr[0]]["stats"]["output"]["avg"] <= active_forms[weakest]["stats"]["output"]["avg"]} (${active_forms[weakest_arr[0]]["stats"]["output"]["avg"]} <= ${active_forms[weakest]["stats"]["output"]["avg"]})`, "debug");
                say(`   2: ${active_forms[weakest]["stats"]["output"]["avg"] <= active_forms[weakest_arr[weakest_arr.length - 1]]["stats"]["output"]["avg"]} (${active_forms[weakest]["stats"]["output"]["avg"]} <= ${active_forms[weakest_arr[weakest_arr.length - 1]]["stats"]["output"]["avg"]})`, "debug");
                say(`   3: ${active_forms[weakest_arr[weakest_arr.length - 1]]["stats"]["output"]["avg"] < active_forms[highest_conf]["stats"]["output"]["avg"]} (${active_forms[weakest_arr[weakest_arr.length - 1]]["stats"]["output"]["avg"]} < ${active_forms[highest_conf]["stats"]["output"]["avg"]})`, "debug");
                delete active_forms[weakest];
            }
        }
        //Mutating
        const permutationmult = (Math.random() + 1) * 10;
        const secondpermutationmult = (Date.now() % (set_parameters["zSize"] * set_parameters["xSize"] * 100) + 10 * Math.sqrt(set_parameters["xSize"] * set_parameters["zSize"])) / (10000) + 1;
        const current_stdev = getStandardDeviation(last_highest);
        const current_mean = getAverage(last_highest);
        let thirdpermutationmultinterm = 1;//(current_stdev / current_mean < convergence_percent_error_threshold && last_highest.length >= max_last_highest ? 100 * (convergence_percent_error_threshold / (current_stdev / current_mean)) : 1); //on/off switch to spam mutations on convergence
        const thirdpermutationmult = (current_stdev == 0 ? set_parameters["zSize"] * set_parameters["xSize"] : thirdpermutationmultinterm);
        //TODO: Allow time to explore new region before calling convergence
        // Currently just using "convergence_detection_count_threshold" as a buffer time to poke around randomly.
        // This is only useful if I find regions that are substantially better than the local optimum, 
        // to the point where a given random configuration in it is better.
        if (current_stdev == 0) {
            for (let key of Object.keys(components)) {
                components[key]["weight"] = 1;
            }
            convergence_detection_count = convergence_detection_count + 1;
            say("Increasing convergence to " + convergence_detection_count + " / " + convergence_detection_count_threshold, "normal");
        } else if (convergence_detection_count > 0) {
            convergence_detection_count = 0;
            say("Resetting convergence to " + convergence_detection_count, "normal");
        }
        const productmult = Math.round(permutationmult * secondpermutationmult * thirdpermutationmult);
        say(`Mutation multipliers:
   avg:${current_mean}
   stdev:${current_stdev}
   1= ${permutationmult}
   2= ${secondpermutationmult}
   3= ${thirdpermutationmult}
   Product= ${productmult}
        `, "verbose");
        let calltime = 0;
        let duplicate_permutation_tries = 0;//failure is duplicate
        while (Object.keys(active_forms).length < max_forms && duplicate_permutation_tries < 20) {
            //repopulate
            let mutation_ancestor = seed;
            if (Object.keys(active_forms).length != 0) {
                mutation_ancestor = Object.keys(active_forms)[Math.ceil(Math.random() * (Object.keys(active_forms).length - 1))];
            }

            let new_conf_returns = make_permutation(mutation_ancestor, productmult);
            if (Object.keys(active_forms).includes(new_conf_returns[0])) {
                //do NOT recalculate duplicate confs.
                duplicate_permutation_tries++;
                stacktrace_iter.push(["duplicategen281", new_conf_returns]);
            } else {
                let new_configuration = new_conf_returns[0];
                active_forms[new_configuration] = { "age": 0 };
                let thiscallstarttime = Date.now();
                active_forms[new_configuration]["stats"] = await get_stats(new_configuration);
                calltime = calltime + Date.now() - thiscallstarttime;
                active_forms[new_configuration]["ancestor"] = mutation_ancestor;

                //analyze the effects of these changes
                if (Object.keys(active_forms).includes(mutation_ancestor)) {
                    let score_diff = active_forms[new_configuration]["stats"]["output"]["avg"] - active_forms[mutation_ancestor]["stats"]["output"]["avg"];
                    let score_diff_percent = score_diff / active_forms[mutation_ancestor]["stats"]["output"]["avg"];
                    for (let tile of Object.keys(new_conf_returns[1])) {
                        components[tile]["weight"] = components[tile]["weight"] + score_diff_percent * new_conf_returns[1][tile] * Math.log(ii) / (max_forms * 100);
                        if (components[tile]["weight"] <= 0) {
                            //weight at or under 0 prevents items from appearing
                            components[tile]["weight"] = 1;
                        }
                    }
                }
            }
        }

        if (ii % log_interval == 0 || (loggedinit == false && Object.keys(active_forms).length >= max_forms)) {
            fs.writeFileSync("../../../reactorsaves/" + ii + ".json", JSON.stringify(active_forms, null, 4), { encoding: false });
            fs.writeFileSync("../../../reactorvars/compweights/" + ii + ".json", JSON.stringify(components, null, 4), { encoding: false });
            if (loggedinit === false) {
                loggedinit = true;
            }
            fs.writeFileSync("../../../reactorsaves/current.json", JSON.stringify(active_forms, null, 4), { encoding: false });
            fs.writeFileSync("../../../reactorvars/compweights/current.json", JSON.stringify(components, null, 4), { encoding: false });
            if (ii % (log_interval) == 0) {
                for (let key of Object.keys(components)) {
                    components[key]["weight"] = 1;
                }
            }
        }


        for (let configuration of Object.keys(active_forms)) {
            active_forms[configuration]["age"]++;
        }
        const nowtime = Date.now();
        say(`Iteration ${ii} complete. (${nowtime - startitertime} ms) {${calltime} ms calling} [${nowtime - startitertime - calltime} ms calculating]`, "sparse");
        if (Object.keys(active_forms).includes(highest_conf)) {
            say(`Iteration ${ii} highest score: \n   Output = ${Math.round(active_forms[highest_conf]["stats"]["output"]["avg"] * 100) / 100} RF/t (old ${old_highest_score})\n   Eating = ${Math.round(active_forms[highest_conf]["stats"]["fuelConsumption"]["avg"] * 100) / 100} mB/t`, "normal");
            if (active_forms[highest_conf]["stats"]["output"]["avg"] < old_highest_score) {
                stacktrace_iter.push(["new_highest_conf320", highest_conf + "-" + active_forms[highest_conf]["stats"]["output"]["avg"]]);
                stacktrace_iter.push(["old_highest_conf321", old_highest_conf + "-" + old_highest_score]);
                fs.writeFileSync("../../../whydoyoudothis" + Date.now() + ".json", JSON.stringify(stacktrace_iter, null, 4), { encoding: "utf-8" });
            }
        }
    }
    fs.writeFileSync("../../../reactorsaves/final.json", JSON.stringify(active_forms, null, 4), { encoding: false });
}


let allcalls = 0;
let errorcalls = 0;
async function givemetheresultalready(data) {
    const funcStart = Date.now();
    let complete = false;
    let result = {};
    while (complete == false) {
        try {
            allcalls++;
            result = await post("api/simulate", data);
            complete = true;
        } catch (err) {
            errorcalls++;
            complete = false;
        }
    }
    say(`givemetheresultalready() [${Date.now() - funcStart} ms]`);
    return result;
}

function getStandardDeviation(array) { //https://stackoverflow.com/a/53577159
    if (array.length == 0) {
        return 0;
    }
    const n = array.length
    const mean = getAverage(array);
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}
function getAverage(array) {
    if (array.length == 0) {
        return 0;
    }
    const n = array.length
    return array.reduce((a, b) => a + b) / n
}
startupArt();
main();



function startupArt() {
    console.log(""
        + "  $$$$$$$\\  $$$$$$\\  $$$$$$\\                                                              \n"
        + "  $$  __$$\\ \\_$$  _|$$  __$$\\                                      .          .           \n"
        + "  $$ |  $$ |  $$ |  $$ /  \\__|                                   :+-         =-           \n"
        + "  $$$$$$$\\ |  $$ |  $$ |$$$$\\                                   =++-      .-++-           \n"
        + "  $$  __$$\\   $$ |  $$ |\\_$$ |                                -++++-     -++++-           \n"
        + "  $$ |  $$ |  $$ |  $$ |  $$ |                              :++++++-   :++++++-           \n"
        + "  $$$$$$$  |$$$$$$\\ \\$$$$$$  |                            :=+++++++- .=+++++++-           \n"
        + "  \\_______/ \\______| \\______/                            -+++++++++-=+++++++++-           \n"
        + "       ______   ______  __       __                     .+++++++++++++++++++++-           \n"
        + "      /      \\ |      \\|  \\     /  \\                    .+++++++++++++++++++++-           \n"
        + "     |  $$$$$$\\ \\$$$$$$| $$\\   /  $$                    .+++++++++++++++++++++-           \n"
        + "     | $$___\\$$  | $$  | $$$\\ /  $$$         -:         .+++++++++++++++++++++-           \n"
        + "      \\$$    \\   | $$  | $$$$\\  $$$$+:       -+=:       .++++++++++++*+==+*+++-           \n"
        + "      _\\$$$$$$\\  | $$  | $$\\$$ $$ $$++=.     -+++=.     .+++++++++++*=    .#++-           \n"
        + "     |  \\__| $$ _| $$_ | $$ \\$$$| $$++++-    -+++++-    .+++++++++++++    -*++-           \n"
        + "      \\$$    $$|   $$ \\| $$  \\$ | $$++++++:  -+++++++:  .+++++++++++++*++*++++-           \n"
        + "       \\$$$$$$  \\$$$$$$ \\$$      \\$$+++++++=.-++++++++=..+++++++++++++++++++++-           \n"
        + "                        ----------=+++++++++++++++++++++-:++++++++++++++++++++-           \n"
        + "                       .+++++++++++++++++++++++++++++++++.=+++++++++++++++++++-           \n"
        + "                       .+++++++++++++++++++++++++++++++++= +++++++++++++++++++-           \n"
        + "                       -++++++++++++++++++++++++++++++++++-.+++++++=++++++++++:           \n"
        + "                     .=++++++++++++++++++++++++++++++++++++.:++++- -++++++++=.            \n"
        + "                   .=++++++++++++++++++++++++++++++++++++++= -+=.  -++++++=:              \n"
        + "                  :+++++++++++++++++++++++++++++++++++++++++- :    -+++++:                \n"
        + "                .+++++++++++++++++++++++++++++++++++++++++++-      -+++-                  \n"
        + "              .=++++++++++++++++++++++++++++++++++++++++++-.       -+=.                   \n"
        + "             =+++++++++++++++++++++++++++++++++++++++++++.         :.                     \n"
        + "            :+++++++++++++++++++++++++++++++++++++++++++-                                 \n"
        + "            :++++++++++++++++++++++++++++++++-++++++++++-                                 \n"
        + "            :+++++++++++++++++++++++++++++++= ++++++++++-                                 \n"
        + "             -++++++++++++++++++++++++++++++= ++++++++++-                                 \n"
        + "              .=++++++++++++++++++++++++++++= ++++++++++-                                 \n"
        + "                .=++++++++++++++++++++++++++= ++++++++++-                                 \n"
        + "                  .+++++++++++++++++++++++++= ++++++++++-                                 \n"
        + "                    -++++++++++=:+++++++++++= ++++++++++-                                 \n"
        + "                     .=+++++++++.+++++++++++= ++++++++++-                                 \n"
        + "                       :++++++++ +++++++++++= ++++++++++-                                 \n"
        + "                       .++++++++.+++++++++++= ++++++++++-                                 \n"
        + "                       .++++++++.+++++++++++= ++++++++++-                                 \n"
        + "                       -++++++++:-++++++++++= ++++++++++:                                 \n"
        + "                     .=++++++++-.=+++++++++=. ++++++++=.                                  \n"
        + "                   .=++++++++=:-+++++++++=:   ++++++=.                                    \n"
        + "                  :++++++++=::++++++++++:     +++++:                                      \n"
        + "                .+++++++++::=+++++++++-       +++=                                        \n"
        + "              .=++++++++-:=+++++++++=:        +=.                                         \n"
        + "             =+++++++++.:++++++++++:          .                                           \n"
        + "            :++++++++++.++++++++++-                                                       \n"
        + "            :++++++++++ ++++++++++-                                                       \n"
        + "            :++++++++++.=+++++++++-                                                       \n"
        + "             -+++++++++-:+++++++++-                                                       \n"
        + "              .=+++++++- .=+++++++-                                                       \n"
        + "                .=+++++-   :=+++++-                                                       \n"
        + "                  .++++-     :++++-                                                       \n"
        + "                    -++-       :++-                                                       \n"
        + "                     .--        .--                                                       \n"
        + "                                                                                          ");
}

function say(message, level = "functions") {
    // functions
    // debug
    // verbose
    // normal
    // sparse
    //There is probably a cuter way to do this
    let shouldlog = false;
    switch (readout_level) {
        case "functions":
            shouldlog = true;
            break;
        case "debug":
            if (level == "sparse" || level == "normal" || level == "verbose" || level == "debug") {
                shouldlog = true;
            }
        case "verbose":
            if (level == "sparse" || level == "normal" || level == "verbose") {
                shouldlog = true;
            }
            break;
        case "normal":
            if (level == "sparse" || level == "normal") {
                shouldlog = true;
            }
            break;
        case "sparse":
            if (level == "sparse") {
                shouldlog = true;
            }
            break;
    }
    if (shouldlog) {
        console.log(`[${level.substring(0, 1)}] ${message}`);
    }
}

function arrmapstack(conf_arr) {
    return conf_arr.map(cnf => {
        return cnf + "-" + active_forms[cnf]["stats"]["output"]["avg"];
    })
}