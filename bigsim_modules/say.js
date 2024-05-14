const index = require("../index");
const readout_level = index.readout_level;
let lastsay = 0;
module.exports = function (message, level = "functions") {
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
            break;
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
        let timedelta = "";
        if (lastsay != 0){
            timedelta = ` [${Date.now() - lastsay}ms]`;
        }
        lastsay = Date.now();
        console.log(`[${level.substring(0, 1)}]${timedelta} ${message}`);
    }
}