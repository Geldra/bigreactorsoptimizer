const fs = require("fs");
const bent = require("bent");
const post = bent("http://localhost:8081/", "POST", "json", 200);
const apiurls = [post];
let aggrocalls = 0;
const active_forms = {};
// "configuration string":{"stats":{}, "age":0}
const max_forms = 100;
const iterations = 100000000;
const log_interval = 100; //interval to save a snapshot of active_forms in ./log/
fs.mkdirSync("../../../reactorsaves", { recursive: true });

// curl -b u1 -c u1 -X POST -H "Content-Type: application/json" -d '{"xSize":7,"zSize":7,"height":7,"layout":"XXXXXXXXXXXXXXXXXXXXXXXXX","isActivelyCooled":false,"controlRodInsertion":0}' localhost:8081/api/simulate
/*{
    "xSize":7,
    "zSize":7,
    "height":7,
    "layout":"XXXXXXXXXXXXXXXXXXXXXXXXX",
    "isActivelyCooled":false,
    "controlRodInsertion":0
}*/

const set_parameters = {
    "xSize": 100,
    "zSize": 100,
    "height": 5,
    "isActivelyCooled": false,
    "controlRodInsertion": 0
}

const fitness_weights = {
    "output": 1,
    "fuelConsumption": -1000
}

const components = { "C": "Gelid Cryotheum", "E": "Liquid Ender", "D": "Diamond Block", "G": "Graphite Block", "R": "Destabilized Redstone", "X": "Control Rod", "L": "Block of Gold", "O": "Air" }

//const seed = "X".repeat((set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2));
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
    }
    let newseed = "";
    let keys = Object.keys(components);
    for (let i = 0; i < (set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2); i++) {
        newseed = newseed + keys[Math.round(Math.random() * (keys.length - 1))]
    }
    return newseed;
}

function make_permutation(parent_configuration, mutations_left) {
    //const mutations = mutations_left;
    //console.log("Making mutations...");
    //const timestart = Date.now();
    let configuration = parent_configuration;
    while (mutations_left > 0) {
        let pos = Math.round(Math.random() * (parent_configuration.length - 1));
        let insert = Object.keys(components)[Math.round(Math.random() * (Object.keys(components).length - 1))];
        configuration = parent_configuration.replaceAt(pos, insert);
        mutations_left--;
    }
    //console.log(`   ${mutations} mutations made! (${(Date.now() - timestart)} ms)`);
    return configuration;
}

const n = 5;
async function get_stats(configuration) {
    let samples = [];
    for (let i = 0; i < n; i++) {
        //console.log("getting stats " + i);
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
        //console.log("stdevsum:" + stdevsum);
        let stdev = Math.sqrt(stdevsum / n);
        //console.log("stdev:" + stdev);
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

function get_weakest_and_strongest_form() {
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
        active_forms[configuration]["score"] = score;
        //console.log("score:" + score);
        if (score < lowest_score) {
            lowest_score = score;
            lowest_score_configuration = configuration;
        }
        if (score > highest_score) {
            highest_score = score;
            highest_score_configuration = configuration;
        }
    }
    //console.log(JSON.stringify(highest_score_configuration));
    //console.log(JSON.stringify(lowest_score_configuration));
    if (highest_score_configuration != "") {
        console.log("Topstats:");
        console.log("    Gen:" + (Math.round(active_forms[highest_score_configuration]["stats"]["output"]["avg"] * 100) / 100) + "+-" + (Math.round(active_forms[highest_score_configuration]["stats"]["output"]["stdev"] * 100) / 100) + " RF/t");
        console.log("    Eat:" + (Math.round(active_forms[highest_score_configuration]["stats"]["fuelConsumption"]["avg"] * 100) / 100) + "+-" + (Math.round(active_forms[highest_score_configuration]["stats"]["fuelConsumption"]["stdev"] * 100) / 100) + " mB/t");
    }
    return {
        "lowest": lowest_score_configuration,
        "highest": highest_score_configuration
    };
}

ii = 1;
const starttime = Date.now();
var loggedinit = false;
async function main() {
    for (ii = init_iteration; ii < iterations + 1; ii++) {
        for (let j = 0; j < Math.round(Math.random() * 10 + 1); j++) {
            let weakest;
            let champs = get_weakest_and_strongest_form();
            if (Math.random() > 0.2) {
                //usually we will kill any non-strongest form
                weakest = Object.keys(active_forms).filter(iform => iform != champs["highest"])[Math.ceil(Math.random() * (Object.keys(active_forms).length - 1))];
            } else {
                //rarely we will simply kill the lowest form
                weakest = champs["lowest"];
            }
            if (Object.keys(active_forms).length >= max_forms / 2) { //prevent population from dropping too much (/shouldn't/ be needed after startup)
                delete active_forms[weakest];
            }
        }
        const permutationmult = Math.random() * 5;
        const secondpermutationmult = Date.now() % 100000 / 10000;
        while (Object.keys(active_forms).length < max_forms) {
            //repopulate
            let mutation_ancestor;
            if (Object.keys(active_forms).length == 0) {
                mutation_ancestor = seed;
            } else {
                mutation_ancestor = Object.keys(active_forms)[Math.ceil(Math.random() * (Object.keys(active_forms).length - 1))];
            }

            let new_configuration = make_permutation(mutation_ancestor, Math.round(Math.random() * 5000 * permutationmult * secondpermutationmult));
            active_forms[new_configuration] = { "age": 0 };
            active_forms[new_configuration]["stats"] = await get_stats(new_configuration);
            active_forms[new_configuration]["ancestor"] = mutation_ancestor;
        }

        if (ii % log_interval == 0 || (loggedinit == false && Object.keys(active_forms).length >= max_forms)) {
            fs.writeFileSync("../../../reactorsaves/" + ii + ".json", JSON.stringify(active_forms, null, 4), { encoding: false });
            if (loggedinit === false) {
                loggedinit = true;
            }
        }
        fs.writeFileSync("../../../reactorsaves/current.json", JSON.stringify(active_forms, null, 4), { encoding: false });

        for (let configuration of Object.keys(active_forms)) {
            active_forms[configuration]["age"]++;
        }
    }
    fs.writeFileSync("../../../reactorsaves/final.json", JSON.stringify(active_forms, null, 4), { encoding: false });
}


let allcalls = 0;
let errorcalls = 0;
async function givemetheresultalready(data) {
    let complete = false;
    let tries = 0;
    let result = {};
    let thiscall = aggrocalls % n + 1;
    aggrocalls++;
    while (complete == false) {
        //await sleep(Math.floor((50 + Math.random() * 50) / apiurls.length));
        tries++;
        try {
            let time_elapsed = (Date.now() - starttime) / 60000;
            let progress_made = ii * n + thiscall;
            let speed = progress_made / time_elapsed;
            let remaining = Math.floor(((iterations - ii) * n + thiscall) / speed);
            console.log("{" + ii + "/" + iterations + "}[" + thiscall + "/" + n + "](x" + tries + ") Making a call... (ETA: " + remaining + " minutes) [" + Math.round(((ii * n + thiscall) / (iterations * n)) * 1000) / 100 + "% progress] {" + Math.round((errorcalls / allcalls) * 1000) / 100 + "% fail rate}");
            allcalls++;
            result = await post("api/simulate", data);
            complete = true;
        } catch (err) {
            errorcalls++;
            console.log("{" + ii + "/" + iterations + "}[" + thiscall + "/" + n + "](x" + tries + ") Keep trying. <" + err.toString() + ">");
            complete = false;
        }
    }
    console.log("{" + ii + "/" + iterations + "}[" + thiscall + "/" + n + "](x" + tries + ") Complete.");
    return result;
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