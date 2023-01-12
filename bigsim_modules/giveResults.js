const index = require("../index");
const say = index.say;
const bent = require("bent");
const post = bent("http://localhost:8081/", "POST", "json", 200);
module.exports = async function (data) {
    const funcStart = Date.now();
    let complete = false;
    let result = {};
    while (complete == false) {
        try {
            result = await post("api/simulate", data);
            complete = true;
        } catch (err) {
            complete = false;
        }
    }
    say(`givemetheresultalready() [${Date.now() - funcStart} ms]`);
    return result;
}