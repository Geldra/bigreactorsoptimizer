const sharp = require("sharp");
const fs = require("fs");
const crypto = require("crypto");
const image_width = 10000;
const image_height = 2500;
const point_radius = 3;

async function buildgraph(stat = "output") {
    const fullstart = Date.now();
    let svgelms = [];
    let maxx = 0;
    let miny = Infinity;
    let maxy = 0;
    let files = fs.readdirSync("../../../reactorsaves").filter(thing => !["current.json"].includes(thing));
    let relations = {}; // hash:{"ancestor":hash, "color":color}
    //sweep files once to get bounds
    let files_parsed = 0;
    const files_length = files.length;
    for (let file of files) {
        let data = JSON.parse(fs.readFileSync("../../../reactorsaves/" + file));
        let iteration = parseInt(file.replace(".json", ""));
        if (iteration > maxx) {
            maxx = iteration;
        }
        for (let conf of Object.keys(data)) {
            let thisone = crypto.createHash("sha512").update(conf).digest("hex");
            let ancestor = crypto.createHash("sha512").update(data[conf]["ancestor"]).digest("hex");
            let stats = data[conf]["stats"][stat];
            if (!Object.keys(relations).includes(thisone)) {
                relations[thisone] = {
                    "ancestor": ancestor,
                    "color": ("#" + Math.floor(Math.random() * 16777215).toString(16)),
                    "coords": [[
                        iteration,
                        stats["avg"],
                        file
                    ]]
                }
            } else {
                relations[thisone]["coords"].push([
                    iteration,
                    stats["avg"],
                    file
                ])
            }
            if (data[conf]["stats"][stat]["avg"] < miny) {
                miny = data[conf]["stats"][stat]["avg"];
            }
            if (data[conf]["stats"][stat]["avg"] > maxy) {
                maxy = data[conf]["stats"][stat]["avg"];
            }
        }
        files_parsed++;
        console.log(`Completed parsing ${file} (${files_parsed}/${files_length})`);
    }
    console.log(`-- Parsing complete, moving to building (${Date.now() - fullstart} ms)`);
    //sweep again to build the data
    let relations_built = 0;
    const relations_length = Object.keys(relations).length;
    for (let relation_ref of Object.keys(relations)) {
        relations[relation_ref]["coords"].sort((a, b) => { return a[0] - b[0] });
        for (let coord of relations[relation_ref]["coords"]) {
            svgelms.push(`
                <circle cx="${getx(coord[0])}" cy="${gety(coord[1])}" r="${point_radius}" fill="${relations[relation_ref]["color"]}" />
            `)
        }
        let start_coord = relations[relation_ref]["coords"][0];
        let end_coord = relations[relation_ref]["coords"][relations[relation_ref]["coords"].length - 1];
        svgelms.push(`
            <line x1="${getx(start_coord[0])}" y1="${gety(start_coord[1])}" x2="${getx(end_coord[0])}" y2="${gety(end_coord[1])}" stroke-width="${Math.ceil(point_radius / 1.2)}" stroke="${relations[relation_ref]["color"]}" />
        `)
        if (start_coord[1] != end_coord[1]) {
            console.log(`What happened here:\nstart = (${getx(start_coord[0])}, ${gety(start_coord[1])})\nstart = (${getx(end_coord[0])}, ${gety(end_coord[1])})`);
        }
        if (Object.keys(relations).includes(relations[relation_ref]["ancestor"])) {
            let end_ancestor = relations[relations[relation_ref]["ancestor"]]["coords"][relations[relations[relation_ref]["ancestor"]]["coords"].length - 1];
            svgelms.push(`
                <line x1="${getx(start_coord[0])}" y1="${gety(end_ancestor[1])}" x2="${getx(start_coord[0])}" y2="${gety(start_coord[1])}" stroke-width="${Math.ceil(point_radius / 4)}" stroke="${relations[relation_ref]["color"]}" />
            `)
        }
        relations_built++;
        console.log(`built ${relation_ref} (${relations_built}/${relations_length})`);
    }
    console.log(`-- Building complete, moving to export (${Date.now() - fullstart} ms)`);
    let fullsvg = `<svg>${svgelms.join("")}</svg>`;
    fs.writeFileSync("./visualizations/test.png", await sharp(Buffer.from(fullsvg), { unlimited: true }).png().toBuffer());
    function getx(rawx) {
        return Math.round((rawx / maxx) * image_width);
    }
    function gety(rawy) {
        return image_height - Math.round(((rawy - miny) / (maxy - miny)) * image_height);
    }
    console.log(`Complete! (${Date.now() - fullstart} ms)`)
}

buildgraph();