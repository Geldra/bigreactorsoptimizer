var ii = 1;
let breakouts = 0;
const max_breakouts = 3; //blank resets to reconverge
const convergence_detection_count_threshold = 75000; //number of times to try escaping the local optimum
var convergence_detection_count = 0;
const max_last_highest = 10; //higher numbers here make it less sensitive to changes
var highest_conf = "";
var last_highest = [];
var loggedinit = false;

const fs = require("fs");

const make_permutation = require("./permutation");
const get_stats = require("./getstats");
const buildrandomseed = require("./buildSeed");
const seed = buildrandomseed();
module.exports.seed = seed;

const index = require("../index");
var init_iteration = index.init_iteration;
const iterations = index.iterations;
const active_forms = index.active_forms;
const max_forms = index.max_forms;
const set_parameters = index.set_parameters;
const components = index.components;
const log_interval = index.log_interval;
const say = index.say;

const utils = index.utils;
const getStandardDeviation = utils.getStandardDeviation;
const getAverage = utils.getAverage;
const floatRound = utils.floatRound;

var optimize_escape_split = 0.5; //if Math.round() is greater, escape. Otherwise, optimize. (high / low mutation count)

const oldconfs = new Set();
var conf_collisions_avoided = 0;

module.exports = async function () {
    for (ii = init_iteration; ii < iterations + 1; ii++) {
        say(`Starting iteration ${ii} of ${iterations}...`,"verbose");
        let stacktrace_iter = [];
        const old_highest_conf = highest_conf;
        const old_highest_score = active_forms.has(old_highest_conf) ? active_forms.get(old_highest_conf)["stats"]["output"]["avg"] : 0;
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
                active_forms.clear();
                active_forms.set(newseed, { "age": 0 });
                active_forms.get(newseed)["stats"] = await get_stats(newseed);
                active_forms.get(newseed)["ancestor"] = "";

                breakouts = breakouts + 1;
            } else {
                //End on max breakouts
                report_results("convergence");
                break;
            }
        }
        say(`Convergence check concluded`,"debug");
        const startitertime = Date.now();
        //Getting the stats on the leader configuration in active_forms
        if (active_forms.size > 0) {
            let highest = [...active_forms.keys()].sort((a, b) => {
                let first = 0;
                let second = 0;
                try {
                    first = active_forms.get(a)["stats"]["output"]["avg"]
                }catch{
                    let results = {};
                    let keys_to_stat = ["coolantTemperature", "fuelConsumption", "fuelFertility", "fuelHeat", "output", "reactorHeat"];
                    for (let key of keys_to_stat) {
                        results[key] = {};
                        results[key]["min"] = 0;
                        results[key]["max"] = 0;
                        results[key]["avg"] = 0;
                        results[key]["stdev"] = 0;
                    }
                    active_forms.get(a)["stats"]=results;
                    first = 0;
                }
                try {
                    second = active_forms.get(b)["stats"]["output"]["avg"]
                }catch{
                    let results = {};
                    let keys_to_stat = ["coolantTemperature", "fuelConsumption", "fuelFertility", "fuelHeat", "output", "reactorHeat"];
                    for (let key of keys_to_stat) {
                        results[key] = {};
                        results[key]["min"] = 0;
                        results[key]["max"] = 0;
                        results[key]["avg"] = 0;
                        results[key]["stdev"] = 0;
                    }
                    active_forms.get(b)["stats"]=results;
                    second = 0;
                }
                
                return first - second;
            });
            stacktrace_iter.push(["highest", arrmapstack(highest)]);
            last_highest.push(active_forms.get(highest[highest.length - 1])["stats"]["output"]["avg"]);
            highest = null;
            if (last_highest.length > max_last_highest) {
                last_highest = last_highest.slice(1);
            }
        }
        say(`Highest stat check concluded`,"debug");
        //Culling
        let cullmax = Math.ceil(Math.random() * 0.9 * max_forms);
        for (let j = 0; j < cullmax; j++) {
            say(`Cull #${j} of ${cullmax}`,"debug");
            if (active_forms.size >= max_forms / 3) { //prevent population from dropping too much (/shouldn't/ be needed after startup)
                let weakest_arr = [...active_forms.keys()].sort((a, b) => {
                    return active_forms.get(a)["stats"]["output"]["avg"] - active_forms.get(b)["stats"]["output"]["avg"];
                });
                stacktrace_iter.push(["weakest_arr213-" + j, arrmapstack(weakest_arr)]);
                highest_conf = weakest_arr[weakest_arr.length - 1];
                stacktrace_iter.push(["highest_conf215-" + j, highest_conf + "-" + active_forms.get(highest_conf)["stats"]["output"]["avg"]]);
                if (old_highest_conf.length > 0) {
                    if (active_forms.has(old_highest_conf)) {
                        if (active_forms.get(highest_conf)["stats"]["output"]["avg"] < active_forms.get(old_highest_conf)["stats"]["output"]["avg"]) {
                            //nonsense situation where highest is not the highest.
                            fs.writeFileSync("../../../whywhywhywhy" + Date.now() + ".json", JSON.stringify(
                                [[highest_conf, active_forms.get(highest_conf)["stats"]["output"]["avg"]], [old_highest_conf, active_forms.get(old_highest_conf)["stats"]["output"]["avg"]]]
                                , null, 4), { encoding: "utf-8" });
                        }
                    }
                }
                weakest_arr = weakest_arr.slice(0, Math.floor(weakest_arr.length / 10));
                stacktrace_iter.push(["weakest_arr225-" + j, arrmapstack(weakest_arr)]);
                let weakest = weakest_arr[Math.floor(Math.random() * weakest_arr.length)];
                stacktrace_iter.push(["weakest227-" + j, weakest + "-" + active_forms.get(weakest)["stats"]["output"]["avg"]]);
                say(`Culling checkstack:`, "debug");
                say(`   1: ${active_forms.get(weakest_arr[0])["stats"]["output"]["avg"] <= active_forms.get(weakest)["stats"]["output"]["avg"]} (${active_forms.get(weakest_arr[0])["stats"]["output"]["avg"]} <= ${active_forms.get(weakest)["stats"]["output"]["avg"]})`, "debug");
                say(`   2: ${active_forms.get(weakest)["stats"]["output"]["avg"] <= active_forms.get(weakest_arr[weakest_arr.length - 1])["stats"]["output"]["avg"]} (${active_forms.get(weakest)["stats"]["output"]["avg"]} <= ${active_forms.get(weakest_arr[weakest_arr.length - 1])["stats"]["output"]["avg"]})`, "debug");
                say(`   3: ${active_forms.get(weakest_arr[weakest_arr.length - 1])["stats"]["output"]["avg"] < active_forms.get(highest_conf)["stats"]["output"]["avg"]} (${active_forms.get(weakest_arr[weakest_arr.length - 1])["stats"]["output"]["avg"]} < ${active_forms.get(highest_conf)["stats"]["output"]["avg"]})`, "debug");
                active_forms.delete(weakest);
            }else{
                break;
            }
        }
        say(`Weak culling concluded`,"debug");
        //Mutating
        const permutationmult = (Math.random() + 1) * 5+20;
        const secondpermutationmult = (Date.now() % (set_parameters["zSize"] * set_parameters["xSize"] * 100) + 10 * Math.sqrt(set_parameters["xSize"] * set_parameters["zSize"])) / (10000) + 1;
        const current_stdev = floatRound(getStandardDeviation(last_highest), 5);
        const current_mean = getAverage(last_highest);
        let thirdpermutationmultinterm = 1;//(current_stdev / current_mean < convergence_percent_error_threshold && last_highest.length >= max_last_highest ? 100 * (convergence_percent_error_threshold / (current_stdev / current_mean)) : 1); //on/off switch to spam mutations on convergence
        const split_rand = Math.random();
        const thirdpermutationmult = (optimize_escape_split > split_rand ? (current_stdev == 0 ? set_parameters["zSize"] * set_parameters["xSize"] : thirdpermutationmultinterm) : 1);
        //TODO: Allow time to explore new region before calling convergence
        // Currently just using "convergence_detection_count_threshold" as a buffer time to poke around randomly.
        // This is only useful if I find regions that are substantially better than the local optimum, 
        // to the point where a given random configuration in it is better.
        say("Convergence is " + convergence_detection_count + " / " + convergence_detection_count_threshold + " (stdev " + current_stdev + ") [" + breakouts + "/" + max_breakouts + " breakouts]", "debug");
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
   3= ${thirdpermutationmult} (${floatRound(split_rand, 5)})
   Product= ${productmult}
        `, "verbose");
        let calltime = 0;
        let duplicate_permutation_tries = 0;//failure is duplicate
        let attempts_to_be_unique = 0;
        let timestartmutating = Date.now();
        let repoploops = 0;
        say(`Starting repopulation loop`,"debug");
        repopstack = [];
        while (active_forms.size < max_forms && duplicate_permutation_tries < convergence_detection_count_threshold && attempts_to_be_unique < convergence_detection_count_threshold) {
            if (repopstack.length > 50){
                await Promise.all(repopstack);
                repopstack = [];
            }
            repopstack.push(repopulate(repoploops+0));
            repoploops++;
            async function repopulate(repopnum){
                say(`Repopulation #${repopnum}`,"debug");
                //repopulate
                let mutation_ancestor = seed;
                if (active_forms.size != 0) {
                    mutation_ancestor = [...active_forms.keys()][Math.floor(Math.random() * (active_forms.size))];
                }

                let new_conf_returns = make_permutation(mutation_ancestor, productmult);
                say(`1 mutation created`,"debug");
                const start_set_search_time = Date.now();
                if (oldconfs.has(new_conf_returns[0])) {
                    say(`2 duplicate detected`,"debug");
                    //do NOT recalculate duplicate confs.
                    if (active_forms.has(new_conf_returns[0])) {
                        duplicate_permutation_tries++;
                    }
                    conf_collisions_avoided++;
                    stacktrace_iter.push(["duplicategen281", new_conf_returns]);
                    attempts_to_be_unique++;
                } else {
                    say(`2 mutation is unique`,"debug");
                    let new_configuration = new_conf_returns[0];
                    oldconfs.add(new_configuration);
                    const calc_set_search_time = Date.now() - start_set_search_time;
                    if (calc_set_search_time > 10) {
                        say(`conf collisions report:\n  Tracking = ${oldconfs.size}\n  Avoided = ${conf_collisions_avoided}\n  Search time = ${Date.now() - start_set_search_time}ms`, "verbose");
                    }
                    say(`3 populating mutation information`,"debug");
                    active_forms.set(new_configuration, { "age": 0 });
                    say(`4 mutation age set`,"debug");
                    let thiscallstarttime = Date.now();
                    active_forms.get(new_configuration)["stats"] = await get_stats(new_configuration);
                    say(`5 mutation stats set`,"debug");
                    calltime = calltime + Date.now() - thiscallstarttime;
                    active_forms.get(new_configuration)["ancestor"] = mutation_ancestor;
                    say(`6 mutation ancestor set`,"debug");

                    //analyze the effects of these changes
                    if (active_forms.has(mutation_ancestor)) {
                        say(`6.5 mutation ancestor found, comparing stats`,"debug");
                        if (!Object.keys(active_forms.get(mutation_ancestor)).includes("output")){
                            say(`Anomalous blank ancestor. Cool.`,"debug");
                            active_forms.delete(mutation_ancestor);
                        }else{
                            let score_diff = active_forms.get(new_configuration)["stats"]["output"]["avg"] - active_forms.get(mutation_ancestor)["stats"]["output"]["avg"];
                            let score_diff_percent = score_diff / active_forms.get(mutation_ancestor)["stats"]["output"]["avg"];
                            for (let tile of Object.keys(new_conf_returns[1])) {
                                components[tile]["weight"] = components[tile]["weight"] + score_diff_percent * new_conf_returns[1][tile] * Math.log(ii) / (max_forms * 100);
                                if (components[tile]["weight"] <= 0) {
                                    //weight at or under 0 prevents items from appearing
                                    components[tile]["weight"] = 1;
                                }
                            }
                        }
                    }
                    say(`7 exit repopulation #${repopnum}`,"debug");
                }
            }
        }
        say(`Time spent mutating: ${Date.now() - timestartmutating}ms`,"verbose");
        if (duplicate_permutation_tries > convergence_detection_count_threshold){
            report_results("explored");
            break;
        }
        if (attempts_to_be_unique > convergence_detection_count_threshold){
            report_results("unoriginal");
            break;
        }

        if (ii % log_interval == 0 || (loggedinit == false && active_forms.size >= max_forms)) {
            fs.writeFileSync("../../../reactorsaves/" + ii + ".json", JSON.stringify(Object.fromEntries([...active_forms.entries()]), null, 4), { encoding: false });
            fs.writeFileSync("../../../reactorvars/compweights/" + ii + ".json", JSON.stringify(components, null, 4), { encoding: false });
            if (loggedinit === false) {
                loggedinit = true;
            }
            fs.writeFileSync("../../../reactorsaves/current.json", JSON.stringify(Object.fromEntries([...active_forms.entries()]), null, 4), { encoding: false });
            fs.writeFileSync("../../../reactorvars/compweights/current.json", JSON.stringify(components, null, 4), { encoding: false });
            if (ii % (log_interval) == 0) {
                for (let key of Object.keys(components)) {
                    components[key]["weight"] = 1;
                }
            }
        }


        for (let configuration of [...active_forms.keys()]) {
            active_forms.get(configuration)["age"]++;
        }
        const nowtime = Date.now();
        say(`Iteration ${ii} complete. (${nowtime - startitertime} ms) {${calltime} ms calling} [${nowtime - startitertime - calltime} ms calculating]`, "sparse");
        if (active_forms.has(highest_conf)) {
            say(`Iteration ${ii} highest score: \n   Output = ${Math.round(active_forms.get(highest_conf)["stats"]["output"]["avg"] * 100) / 100} RF/t (old ${old_highest_score})\n   Eating = ${Math.round(active_forms.get(highest_conf)["stats"]["fuelConsumption"]["avg"] * 100) / 100} mB/t`, "normal");
            if (active_forms.get(highest_conf)["stats"]["output"]["avg"] < old_highest_score) {
                stacktrace_iter.push(["new_highest_conf320", highest_conf + "-" + active_forms.get(highest_conf)["stats"]["output"]["avg"]]);
                stacktrace_iter.push(["old_highest_conf321", old_highest_conf + "-" + old_highest_score]);
                fs.writeFileSync("../../../whydoyoudothis" + Date.now() + ".json", JSON.stringify(stacktrace_iter, null, 4), { encoding: "utf-8" });
            }
        }
    }
    function arrmapstack(conf_arr) {
        return conf_arr.map(cnf => {
            let this_is_dumb = cnf + "-0";
            try{
                this_is_dumb = cnf + "-" + active_forms.get(cnf)["stats"]["output"]["avg"];
            }catch{

            }
            return ;
        })
    }
    fs.writeFileSync("../../../reactorsaves/final.json", JSON.stringify(Object.fromEntries([...active_forms.entries()]), null, 4), { encoding: false });
}

function report_results(condition) {
    switch(condition){
        case "convergence":
            say("No more breakouts. Results:", "sparse");
            break;
        case "unoriginal":
            say("Originality too expensive. Results:", "sparse");
            break;
        case "explored":
            say("Solution space explored. Results:", "sparse");
            break;
    }
    const highest_stats = active_forms.get(highest_conf)["stats"];
    for (let key of Object.keys(highest_stats)) {
        say("   " + key + "= " + highest_stats[key]["avg"] + " +- " + highest_stats[key]["stdev"], "sparse");
    }
}