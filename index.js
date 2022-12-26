const fs = require("fs");
const bent = require("bent");
const post = bent("http://localhost:8081/", "POST", "json", 200);
const active_forms = {};
// "configuration string":{"stats":{}, "age":0}
const max_forms = 125;
const iterations = 100000000;
const log_interval = 100; //interval to save a snapshot of active_forms in ./log/
fs.mkdirSync("../../../reactorsaves", { recursive: true });
fs.mkdirSync("../../../reactorimagesaves", { recursive: true });
fs.mkdirSync("../../../reactorvars/compweights", { recursive: true });

const set_parameters = {
    "xSize": 100,
    "zSize": 100,
    "height": 5,
    "isActivelyCooled": false,
    "controlRodInsertion": 0
}

const components = buildComponents();
function buildComponents() {
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
    return initcomps;
}

let init_iteration = 1;
const seed = buildrandomseed();

function buildrandomseed() {
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
        console.log("Imported from file");
    }
    let newseed = "";
    for (let i = 0; i < (set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2); i++) {
        newseed = newseed + "X";
    }
    return newseed;
}

function make_permutation(parent_configuration, mutations_left) {
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
    return [configuration, changes];
}

const n = 1;
async function get_stats(configuration) {
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
    return results;
}

String.prototype.replaceAt = function (index, replacement) {
    return this.substring(0, index) + replacement + this.substring(index + replacement.length);
}

ii = 1;
const starttime = Date.now();
var loggedinit = false;
var last_highest = [];
const max_last_highest = 5;
async function main() {
    for (ii = init_iteration; ii < iterations + 1; ii++) {
        const startitertime = Date.now();
        //Recording a set of samples for standard deviation calc
        let highest = Object.keys(active_forms).sort((a, b) => {
            return active_forms[a]["stats"]["output"]["avg"] - active_forms[b]["stats"]["output"]["avg"];
        });
        last_highest.push(active_forms[highest[highest.length - 1]]["stats"]["output"]["avg"]);
        highest = null;
        if (last_highest.length > max_last_highest) {
            last_highest = last_highest.slice(1);
        }
        //Culling
        for (let j = 0; j < Math.ceil(Math.random() * max_forms); j++) {
            if (Object.keys(active_forms).length >= max_forms / 3) { //prevent population from dropping too much (/shouldn't/ be needed after startup)
                let weakest_arr = Object.keys(active_forms).sort((a, b) => {
                    return active_forms[a]["stats"]["output"]["avg"] - active_forms[b]["stats"]["output"]["avg"];
                });
                weakest_arr = weakest_arr.slice(0, Math.floor(weakest_arr.length / 10));
                let weakest = weakest_arr[Math.floor(Math.random() * weakest_arr.length)];
                delete active_forms[weakest];
            }
        }
        //Mutating
        const permutationmult = (Math.random() + 1) * 2;
        const secondpermutationmult = (Date.now() % (set_parameters["zSize"] * set_parameters["xSize"] * 100) + 10 * Math.sqrt(set_parameters["xSize"] * set_parameters["zSize"])) / (10000);
        const current_stdev = getStandardDeviation(last_highest);
        const thirdpermutationmult = Math.log(0.1 / ((current_stdev != 0 ? current_stdev : 0.001) / last_highest[0]));
        let calltime = 0;
        while (Object.keys(active_forms).length < max_forms) {
            //repopulate
            let mutation_ancestor;
            if (Object.keys(active_forms).length == 0) {
                mutation_ancestor = seed;
            } else {
                mutation_ancestor = Object.keys(active_forms)[Math.ceil(Math.random() * (Object.keys(active_forms).length - 1))];
            }

            let new_conf_returns = make_permutation(mutation_ancestor, Math.round((Math.random() + 1) * 5 * permutationmult * secondpermutationmult * thirdpermutationmult));
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

        if (ii % log_interval == 0 || (loggedinit == false && Object.keys(active_forms).length >= max_forms)) {
            fs.writeFileSync("../../../reactorsaves/" + ii + ".json", JSON.stringify(active_forms, null, 4), { encoding: false });
            fs.writeFileSync("../../../reactorvars/compweights/" + ii + ".json", JSON.stringify(components, null, 4), { encoding: false });
            if (loggedinit === false) {
                loggedinit = true;
            }
            fs.writeFileSync("../../../reactorsaves/current.json", JSON.stringify(active_forms, null, 4), { encoding: false });
            fs.writeFileSync("../../../reactorvars/compweights/current.json", JSON.stringify(components, null, 4), { encoding: false });
        }


        for (let configuration of Object.keys(active_forms)) {
            active_forms[configuration]["age"]++;
        }
        const nowtime = Date.now()
        console.log(`Iteration ${ii} complete. (${nowtime - startitertime} ms) {${calltime} ms calling} [${nowtime - startitertime - calltime} ms calculating]`);
    }
    fs.writeFileSync("../../../reactorsaves/final.json", JSON.stringify(active_forms, null, 4), { encoding: false });
}


let allcalls = 0;
let errorcalls = 0;
async function givemetheresultalready(data) {
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
    return result;
}

function getStandardDeviation(array) { //https://stackoverflow.com/a/53577159
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
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