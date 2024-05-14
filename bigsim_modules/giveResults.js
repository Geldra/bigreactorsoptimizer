const index = require("../index");
const say = index.say;
const bent = require("bent");
const post = bent("http://localhost:8081/", "POST", "json", 200);
const max_failures = 3;
module.exports = async function (data) {
    const funcStart = Date.now();
    let complete = false;
    let result = {};
    let failures = 0;
    while (complete == false && failures < max_failures) {
        try {
            result = await post("api/simulate", data);
            complete = true;
        } catch (err) {
            failures++;
            say(`Calling error (${failures}/${max_failures}): ${err}`,"debug")
            complete = false;
        }
    }
    if (complete == false){
        result = {"error":"Max retries reached"}
    }
    say(`givemetheresultalready() [${Date.now() - funcStart} ms]`,"debug");
    return result;
}