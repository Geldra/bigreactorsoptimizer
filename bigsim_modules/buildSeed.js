const index = require("../index");
const fs = index.fs;
const say = index.say;
const active_forms = index.active_forms;
const set_parameters = index.set_parameters;

module.exports = function () {
    const funcStart = Date.now();
    if (fs.existsSync("../../../reactorsaves/current.json")) {
        let highest_iteration = 1;
        for (let file of fs.readdirSync("../../../reactorsaves").filter(ifile => ![".", "..", "current.json"].includes(ifile))) {
            let new_num = parseInt(file.replace(".json", ""));
            if (new_num > highest_iteration) {
                highest_iteration = new_num;
            }
        }
        index.init_iteration = highest_iteration;
        let import_forms = JSON.parse(fs.readFileSync("../../../reactorsaves/current.json"));
        for (let key of Object.keys(import_forms)) {
            active_forms.set(key, import_forms[key]);
        }
        say("Imported from file", "normal");
    }
    let newseed = "";
    for (let i = 0; i < (set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2); i++) {
        newseed = newseed + (Math.random() < 0.1 ? "X" : "O");
    }
    say(`buildrandomseed() [${Date.now() - funcStart} ms]`);
    return newseed;
}