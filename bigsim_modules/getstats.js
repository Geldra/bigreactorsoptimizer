const index = require("../index");
const set_parameters = index.set_parameters;
const say = index.say;

const givemetheresultalready = require("./giveResults");

const n = 7; //number of samples to take
module.exports = async function (configuration) {
    say(`Attempting to get stats`,"debug");
    if (configuration.replaceAll("O","").length > 0){
        say(`Why do you do this ${configuration.replaceAll("O","").length}`,"debug");
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
                if (Object.keys(sample).includes("error")){
                    sum = sum;
                    continue;
                }
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
    }else{
        let keys_to_stat = ["coolantTemperature", "fuelConsumption", "fuelFertility", "fuelHeat", "output", "reactorHeat"];
        for (let key of keys_to_stat) {
            results[key] = {};
            results[key]["min"] = 0;
            results[key]["max"] = 0;
            results[key]["avg"] = 0;
            results[key]["stdev"] = 0;
        }
        return results;
    }   
}