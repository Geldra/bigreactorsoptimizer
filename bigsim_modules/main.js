var ii = 1;
let breakouts = 0;
const max_breakouts = 5; //blank resets to reconverge
const convergence_detection_count_threshold = 75000; //number of times to piddle in a local optimum before escaping global
var convergence_detection_count = 0;
const max_last_highest = 10; //higher numbers here make it less sensitive to changes
var highest_conf = "";
var highest_stats = {};
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

const initcomps = index.initcomps;
const palette = Object.keys(initcomps);

var optimize_escape_split = 0.5; //if Math.round() is greater, escape. Otherwise, optimize. (high / low mutation count)

const oldconfs = new Set();
var conf_collisions_avoided = 0;

var target_power = 700000;
var target_fuel_use = 0;
var times_highest_in_stdev = 0; // Iterates when highest fitness conf's power output stays within its stdev of last most fit power.
const max_times_highest_in_stdev = 150;
var optimization_focus = "fuel" // "energy" or "fuel"
var iterations_since_last_focus_switch = 0;
const min_iterations_since_last_focus_switch = 1;

module.exports = async function () {
    for (ii = init_iteration; ii < iterations + 1; ii++) {
        say(`Starting iteration ${ii} of ${iterations}...`,"verbose");
        iterations_since_last_focus_switch++;
        let stacktrace_iter = [];
        const old_highest_conf = highest_conf;
        const old_highest_score = active_forms.has(old_highest_conf) ? active_forms.get(old_highest_conf)["stats"]["output"]["avg"] : 0;
        stacktrace_iter.push(["old_highest_conf165", old_highest_conf + "-" + old_highest_score]);

        //Check if convergence has been reached
        if (convergence_detection_count > convergence_detection_count_threshold) {
            say("  Convergence detected.", "sparse");
            if (breakouts < max_breakouts) {
                //Breakout
                say(`    Attempting convergence breakout... (${breakouts}/${max_breakouts})`, "sparse");
                let newseed = "";
                for (let i = 0; i < (set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2); i++) {
                    let addition = palette[Math.round((palette.length-1)*Math.random())];
                    newseed = newseed + addition;
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
        say(`  Convergence check concluded`,"debug");
        const startitertime = Date.now();

        // Sort the current data
        /*if (times_highest_in_stdev > max_times_highest_in_stdev){
            target_power += 10000;
            times_highest_in_stdev = 0;
            optimization_focus = "energy";
        }*/
        function calc_fitness(stats){
            if (optimization_focus == "energy"){
                return Math.min(Math.max((stats["stats"]["output"]["avg"]/stats["stats"]["fuelConsumption"]["avg"])/(target_power/target_fuel_use),0.95),1)*stats["stats"]["output"]["avg"];
            }
            let fuel_economy = Math.min(stats["stats"]["output"]["avg"]/target_power,1)*(stats["stats"]["output"]["avg"]/stats["stats"]["fuelConsumption"]["avg"]);
            return fuel_economy;
        }
        let weakest_arr = [...active_forms.keys()].sort((a, b) => {
            let a_value = calc_fitness(active_forms.get(a)); // active_forms.get(a)["stats"]["output"]["avg"]
            let b_value = calc_fitness(active_forms.get(b)); // active_forms.get(b)["stats"]["output"]["avg"]
            return a_value - b_value;
        });

        //Getting the stats on the leader configuration in weakest_arr
        if (weakest_arr.length > 0) {
            say(`(adding) Contenders in weakest_arr: ${weakest_arr.length}`,"debug");
            highest_conf = weakest_arr[weakest_arr.length - 1];
            highest_stats = active_forms.get(highest_conf);
            last_highest.push(highest_stats["stats"]["output"]["avg"]);
            if (last_highest.length > max_last_highest) {
                last_highest = last_highest.slice(1);
            }
            if (highest_stats["stats"]["output"]["avg"] > target_power*1.1){
                // Enter here if significant improvement in power is made
                //target_power = highest_stats["stats"]["output"]["avg"];
                //target_fuel_use = highest_stats["stats"]["fuelConsumption"]["avg"];
                if (iterations_since_last_focus_switch > min_iterations_since_last_focus_switch){
                    if (optimization_focus != "fuel"){
                        iterations_since_last_focus_switch = 0;
                    }
                    optimization_focus = "fuel";
                }
            }else if (highest_stats["stats"]["output"]["avg"] > target_power*0.9){
                // Enter here if we are within power envelope.
                if (iterations_since_last_focus_switch > min_iterations_since_last_focus_switch && highest_stats["stats"]["output"]["avg"] > target_power){
                    if (optimization_focus != "fuel"){
                        iterations_since_last_focus_switch = 0;
                    }
                    optimization_focus = "fuel";
                }
                    // Passes true if no real power difference
                let no_effort_being_made = Math.abs(highest_stats["stats"]["output"]["avg"] - target_power) < highest_stats["stats"]["output"]["stdev"]/10;

                    // Passes true if highest has left target margin
                let powerdiff = Math.abs(highest_stats["stats"]["output"]["avg"] - target_power) > highest_stats["stats"]["output"]["stdev"]*10;

                    // Passes true if fuel economy has improved from target
                let fueldiff =  target_fuel_use == 0 || ((highest_stats["stats"]["output"]["avg"]/highest_stats["stats"]["fuelConsumption"]["avg"]) - (target_power/target_fuel_use) > 0);

                if (no_effort_being_made){
                    times_highest_in_stdev++; // One more step towards convergence
                }
                if (powerdiff){
                    times_highest_in_stdev = Math.max(times_highest_in_stdev - 1, 0); // Marginally reward changes in power output
                }
                if (fueldiff){
                    times_highest_in_stdev = 0; // Massively reward improving fuel economy by reseting chances
                    target_fuel_use = highest_stats["stats"]["fuelConsumption"]["avg"];
                }
            }else{
                // we are below the power envelope
                if (optimization_focus != "energy"){
                    iterations_since_last_focus_switch = 0;
                }
                optimization_focus = "energy";
            }
        }
        say(`  Highest stat check concluded`,"fuel");
        //Culling
        let cullmax = Math.ceil(Math.random() * 0.8 * max_forms);
        say(`  Starting cull. afrm=${active_forms.size} warr=${weakest_arr.length}`,"verbose");
        for (let j = 0; j < cullmax; j++) {
            say(`Cull #${j} of ${cullmax}`,"debug");
            if (active_forms.size >= max_forms / 3) { //prevent population from dropping too much (/shouldn't/ be needed after startup)
                let magicnumber = Math.floor(Math.random() * (weakest_arr.length / 10));
                let weakest = weakest_arr.splice(magicnumber,1)[0];
                active_forms.delete(weakest);
            }else{
                break;
            }
        }
        say(`  Completed cull. afrm=${active_forms.size} warr=${weakest_arr.length}`,"verbose");
        //Mutating
        const permutationmult = (Math.random() + 1) * 50+100;
        const secondpermutationmult = (Date.now() % (set_parameters["zSize"] * set_parameters["xSize"] * 100) + 10 * Math.sqrt(set_parameters["xSize"] * set_parameters["zSize"])) / (10000) + 1;
        const current_stdev = floatRound(getStandardDeviation(last_highest), 5);
        const current_mean = getAverage(last_highest);
        let thirdpermutationmultinterm = 1; //(current_stdev / current_mean < convergence_percent_error_threshold && last_highest.length >= max_last_highest ? 100 * (convergence_percent_error_threshold / (current_stdev / current_mean)) : 1); //on/off switch to spam mutations on convergence
        const split_rand = Math.random();
        const thirdpermutationmult = (optimize_escape_split > split_rand ? (current_stdev == 0 ? set_parameters["zSize"] * set_parameters["xSize"] : thirdpermutationmultinterm) : 1);
        //TODO: Allow time to explore new region before calling convergence
        // Currently just using "convergence_detection_count_threshold" as a buffer time to poke around randomly.
        // This is only useful if I find regions that are substantially better than the local optimum, 
        // to the point where a given random configuration in it is better.
        say("  Convergence is " + convergence_detection_count + " / " + convergence_detection_count_threshold + " (stdev " + current_stdev + ") [" + breakouts + "/" + max_breakouts + " breakouts]", "debug");
        if (current_stdev == 0) {
            if (convergence_detection_count / convergence_detection_count_threshold > (6/1000)){ //attempts to give a jolt to a suboptimal optimization slope
                for (let key of Object.keys(components)) {
                    components[key]["weight"] = 1;
                }
            }
            convergence_detection_count = convergence_detection_count + 1;
            say("    Increasing convergence to " + convergence_detection_count + " / " + convergence_detection_count_threshold, "normal");
        } else if (convergence_detection_count > 0) {
            convergence_detection_count = 0;
            say("    Resetting convergence to " + convergence_detection_count, "normal");
        }
        const productmult = Math.round(permutationmult * secondpermutationmult * thirdpermutationmult);
        say(`  Mutation multipliers:
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
        let repops = 0;
        let errorpops = 0;
        let repopstacknum = 0;
        say(`  Starting repopulation loop`,"verbose");
        repopstack = [];
        while (active_forms.size < max_forms && duplicate_permutation_tries < convergence_detection_count_threshold && attempts_to_be_unique < convergence_detection_count_threshold) {
            if (repopstack.length > 1000 || !(active_forms.size < max_forms && duplicate_permutation_tries < convergence_detection_count_threshold && attempts_to_be_unique < convergence_detection_count_threshold)){
                repopstacknum++;
                say(`    Completing repopulation stack #${repopstacknum}`,"verbose");
                await Promise.all(repopstack);
                say(`    Completed repopulation stack #${repopstacknum} (${repops}/${repoploops} successful repops) (${active_forms.size} active forms) (${errorpops} errors)`,"verbose");
                repopstack = [];
                if (active_forms.size > max_forms - 1){
                    break;
                }
            }
            repopstack.push(repopulate(repoploops+0));
            repoploops++;
            async function repopulate(repopnum){
                say(`      Repopulation #${repopnum}`,"debug");
                //repopulate
                let mutation_ancestor = seed;
                if (active_forms.size != 0) {
                    mutation_ancestor = [...active_forms.keys()][Math.floor(Math.random() * (active_forms.size))];
                }

                let new_conf_returns = make_permutation(mutation_ancestor, productmult);
                say(`      1 mutation created`,"debug");
                const start_set_search_time = Date.now();
                if (oldconfs.has(new_conf_returns[0])) {
                    say(`        duplicate #${conf_collisions_avoided} detected (library size = ${oldconfs.size})`,"debug");
                    //do NOT recalculate duplicate confs.
                    if (active_forms.has(new_conf_returns[0])) {
                        duplicate_permutation_tries++;
                    }
                    conf_collisions_avoided++;
                    stacktrace_iter.push(["duplicategen281", new_conf_returns]);
                    attempts_to_be_unique++;
                } else {
                    say(`        2 mutation is unique`,"debug");
                    let new_configuration = new_conf_returns[0];
                    if (oldconfs.size > 10000000){
                        oldconfs.clear();
                    }
                    oldconfs.add(new_configuration);
                    const calc_set_search_time = Date.now() - start_set_search_time;
                    if (calc_set_search_time > 10) {
                        say(`          conf collisions report:\n  Tracking = ${oldconfs.size}\n  Avoided = ${conf_collisions_avoided}\n  Search time = ${Date.now() - start_set_search_time}ms`, "verbose");
                    }
                    say(`        3 populating mutation information`,"debug");
                    let thiscallstarttime = Date.now();
                    let og_af_size = active_forms.size;
                    active_forms.set(new_configuration, { "age": 0, "ancestor": mutation_ancestor }); //reserving the slot in active_forms under the assumption it will fill it
                    let stats = await get_stats(new_configuration);
                    if (!Object.keys(stats).includes("error")){
                        active_forms.get(new_configuration)["stats"] = stats //filling the slot in active_forms fully
                        if (active_forms.size > og_af_size){
                            repops++;
                        }
                        calltime = calltime + Date.now() - thiscallstarttime;
                        say(`        4 mutation data set`,"debug");
    
                        //analyze the effects of these changes
                        mutation_ancestor_race_cheat = active_forms.get(mutation_ancestor)
                        if (mutation_ancestor_race_cheat != undefined) {
                            say(`        4.5 mutation ancestor found, comparing stats`,"debug");
                            while(!Object.keys(mutation_ancestor_race_cheat).includes("stats")){
                                await new Promise(r => setTimeout(r, 100)); //awful, I know!
                            }
                            if (!Object.keys(mutation_ancestor_race_cheat["stats"]).includes("output")){
                                say(`        Anomalous blank ancestor. Cool.`,"verbose");
                                active_forms.delete(mutation_ancestor);
                            }else{
                                let score_diff = active_forms.get(new_configuration)["stats"]["output"]["avg"] - mutation_ancestor_race_cheat["stats"]["output"]["avg"];
                                let score_diff_percent = score_diff / mutation_ancestor_race_cheat["stats"]["output"]["avg"];
                                for (let tile of Object.keys(new_conf_returns[1])) {
                                    components[tile]["weight"] = components[tile]["weight"] + score_diff_percent * new_conf_returns[1][tile] * Math.log(ii) / (max_forms * 100);
                                    if (components[tile]["weight"] <= 0) {
                                        //weight at or under 0 prevents items from appearing
                                        components[tile]["weight"] = 1;
                                    }
                                }
                            }
                        }
                        say(`        5 exit repopulation #${repopnum}`,"debug");
                    }else{
                        active_forms.delete(new_configuration); //taksies backsies
                        errorpops++;
                    }
                }
            }
        }
        repopstacknum++;
        say(`  Completing repopulation stack #${repopstacknum}`,"normal");
        await Promise.all(repopstack);
        say(`  Completed repopulation stack #${repopstacknum} (${repops}/${repoploops} successful repops) (${active_forms.size} active forms) (${errorpops} errors)`,"normal");
        say(`  Duplicates report: ${conf_collisions_avoided} detected (library = ${oldconfs.size})`,"normal");
        repopstack = [];
        say(`  Time spent mutating: ${Date.now() - timestartmutating}ms`,"verbose");
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
        say(`Iteration ${ii} complete. (${nowtime - startitertime} ms) {${calltime} ms calling} [${Math.ceil((calltime / (nowtime - startitertime))*10000)/100}% speedup]`, "sparse");
        if (active_forms.has(highest_conf)) {
            say(`Iteration ${ii} highest score: \n   Output = ${Math.round(active_forms.get(highest_conf)["stats"]["output"]["avg"] * 100) / 100} RF/t (old ${Math.round(old_highest_score*100)/100}) (target ${Math.round(target_power*100)/100}, idle: ${times_highest_in_stdev}/${max_times_highest_in_stdev}, focus: ${optimization_focus})\n   Eating = ${Math.round(active_forms.get(highest_conf)["stats"]["fuelConsumption"]["avg"] * 100) / 100} mB/t (econ: ${Math.round(((active_forms.get(highest_conf)["stats"]["output"]["avg"]/1000)/active_forms.get(highest_conf)["stats"]["fuelConsumption"]["avg"])*100)/100} kRF/mB) (${iterations_since_last_focus_switch}/${min_iterations_since_last_focus_switch})`, "normal");
            /*if (active_forms.get(highest_conf)["stats"]["output"]["avg"] < old_highest_score) {
                stacktrace_iter.push(["new_highest_conf320", highest_conf + "-" + active_forms.get(highest_conf)["stats"]["output"]["avg"]]);
                stacktrace_iter.push(["old_highest_conf321", old_highest_conf + "-" + old_highest_score]);
                try{
                    fs.writeFileSync("../../../whydoyoudothis" + Date.now() + ".json", JSON.stringify(stacktrace_iter, null, 4), { encoding: "utf-8" });
                }catch (err){
                    fs.writeFileSync("../../../whydoyoudothis" + Date.now() + ".json", `God knows, man.\n${err}\nstacktrace_iter.length = ${stacktrace_iter.length}`, { encoding: "utf-8" });
                } 
            }*/
        }
    }
    function arrmapstack(conf_arr) {
        return conf_arr.map(cnf => {
            let this_is_dumb = cnf + "-0";
            try{
                this_is_dumb = cnf + "-" + active_forms.get(cnf)["stats"]["output"]["avg"];
            }catch{

            }
            return this_is_dumb;
        })
    }
    fs.writeFileSync("../../../reactorsaves/final.json", JSON.stringify(Object.fromEntries([...active_forms.entries()]), null, 4), { encoding: false });
    say(`I am under the illusion that my job is done.`,"sparse")
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
    //const highest_stats = active_forms.get(highest_conf)["stats"];
    for (let key of Object.keys(highest_stats)) {
        say("   " + key + "= " + highest_stats[key]["avg"] + " +- " + highest_stats[key]["stdev"], "sparse");
    }
}