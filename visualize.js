const sharp = require("sharp");
const fs = require("fs");
const image_width = 2000;
const image_height = 1000;
const point_radius = 3;

async function buildgraph(stat = "output") {
    let svgelms = [];
    let maxx = 0;
    let miny = Infinity;
    let maxy = 0;
    let files = fs.readdirSync("../../../reactorsaves").filter(thing => !["current.json"].includes(thing));
    //sweep files once to get bounds
    for (let file of files) {
        let data = JSON.parse(fs.readFileSync("../../../reactorsaves/" + file));
        let iteration = parseInt(file.replace(".json", ""));
        if (iteration > maxx) {
            maxx = iteration;
        }
        for (let conf of Object.keys(data)) {
            if (data[conf]["stats"][stat]["avg"] < miny) {
                miny = data[conf]["stats"][stat]["avg"];
            }
            if (data[conf]["stats"][stat]["avg"] > maxy) {
                maxy = data[conf]["stats"][stat]["avg"];
            }
        }
    }
    //sweep again to build the data
    for (let file of files) {
        let data = JSON.parse(fs.readFileSync("../../../reactorsaves/" + file));
        let color = "#" + Math.floor(Math.random() * 16777215).toString(16);
        let iteration = parseInt(file.replace(".json", ""));
        for (let conf of Object.keys(data)) {
            let stats = data[conf]["stats"][stat];
            svgelms.push(`
                <circle cx="${Math.round((iteration / maxx) * image_width)}" cy="${image_height - Math.round(((stats["avg"] - miny) / (maxy - miny)) * image_height)}" r="${point_radius}" fill="${color}" />
            `)
        }
    }
    let fullsvg = `<svg>${svgelms.join("")}</svg>`
    fs.writeFileSync("./visualizations/test.png", await sharp(Buffer.from(fullsvg)).png().toBuffer());
}

buildgraph();