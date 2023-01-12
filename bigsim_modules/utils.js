function getStandardDeviation(array) { //https://stackoverflow.com/a/53577159
    if (array.length == 0) {
        return 0;
    }
    const n = array.length
    const mean = getAverage(array);
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}
module.exports.getStandardDeviation = getStandardDeviation;

function getAverage(array) {
    if (array.length == 0) {
        return 0;
    }
    const n = array.length
    return array.reduce((a, b) => a + b) / n
}
module.exports.getAverage = getAverage;

function floatRound(number, digits) {
    return number.toFixed(digits);
}
module.exports.floatRound = floatRound;