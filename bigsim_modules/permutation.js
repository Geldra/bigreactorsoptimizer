const index = require("../index");
const components = index.components;
const set_parameters = index.set_parameters;
const say = index.say;

const reactorsize = (set_parameters["xSize"] - 2) * (set_parameters["zSize"] - 2);
module.exports.reactorsize = reactorsize;

module.exports = function (parent_configuration, mutations_left) {
    const funcStart = Date.now();
    let configuration = parent_configuration;
    let changes = new Map();
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
    //mutate
    var available_pos = [...Array(reactorsize).keys()];
    const do_bias = Math.random() > 0.4;
    const tile_bias = tiles[Math.round((tiles.length - 1)*Math.random())];
    while (mutations_left > 0 && available_pos.length > 0) {
        //let pos = Math.round(Math.random() * (parent_configuration.length - 1));
        let pos = available_pos[Math.floor(Math.random() * available_pos.length)];
        available_pos.splice(available_pos.indexOf(pos), 1);
        let insert = tiles[tiles.length - 1]; //default tile
        if (do_bias && Math.random() > 0.1){
            // Bias behavior, tile_bias tile
            insert = tile_bias;
        }else{
            // Default behavior, weighted random tile
            let insertrand = Math.random();
            for (let i = 0; i < tile_weights.length; i++) {
                if (insertrand < tile_weights[i]) {
                    insert = tiles[i];
                    break;
                }
            }
        }
        configuration = parent_configuration.replaceAt(pos, insert);
        if (changes.has(insert)) {
            changes.set(insert, changes.get(insert) + 1);
        } else {
            changes.set(insert, 1);
        }
        mutations_left--;
    }
    say(`make_permutation() [${Date.now() - funcStart} ms]`);
    return [configuration, Object.fromEntries([...changes.entries()])];
}
String.prototype.replaceAt = function (indx, replacement) {
    return this.substring(0, indx) + replacement + this.substring(indx + replacement.length);
}