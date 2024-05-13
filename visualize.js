const sharp = require("sharp");
const fs = require("fs");
const mh = require("metrohash").MetroHash128;
const { Client, EmbedBuilder, GatewayIntentBits } = require("discord.js");
fs.mkdirSync("./visualizations", { recursive: true });
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});
const image_width = 5000;
const image_height = 1500;
const image_margins = {
    "left": 15,
    "right": 15,
    "top": 15,
    "bottom": 45
}
const sidohorg_reactor_bounds = {
    "width": 32,
    "height": 32
}
const users_to_notify_upon_completion = [
    "317799838362370070",
    "283435626844389376"
]
const reactor_width = 30;
const reactor_length = 30;
const reactor_height = 10;
const tile_size = 7; //pixels width
const point_radius = 3;
let last_update = 0;
const spamchanid = process.argv[3];
let spamchan = null;
let last_max_iteration = 0;
let last_max_iteration_high_stats = {};
let highestconf = "";
const testing = process.argv[4] == "test" ? true : false;
let last_highest_file_iteration = 0;
let sent_convergence_message = false;
let maxx = 0;

client.once('ready', async () => {
    console.log("Ready to make pictures!!!!");
    spamchan = await client.channels.fetch(spamchanid);
    await compressTiles();
    await updateloop();
    client.destroy();
});
const discord_token = process.argv[2];
client.login(discord_token);

const tiles = new Map();
async function compressTiles() {
    for (let tilename of fs.readdirSync("./assets/")) {
        console.log("Compressing " + tilename);
        tiles.set(tilename.replace(".gif", ""), await sharp("./assets/" + tilename).resize({ width: tile_size, height: tile_size }).toBuffer());
    }
}

async function drawReactor(conf, width = reactor_width, height = reactor_length) {
    let internals_composite = [];
    internals_composite.push({ input: tiles.get("casing-corner"), top: 0, left: 0 });
    for (let i = 0; i < width - 2; i++) {
        internals_composite.push({ input: tiles.get("casing-lr"), top: 0, left: (i * tile_size) + tile_size });
    }
    internals_composite.push({ input: tiles.get("casing-corner"), top: 0, left: (width - 1) * tile_size });
    for (let i = 0; i < conf.length; i++) {
        const topoffset = (Math.floor(i / (width - 2)) + 1) * tile_size;
        if (i % (width - 2) === 0) {
            internals_composite.push({ input: tiles.get("casing-ud"), top: topoffset, left: 0 });
            internals_composite.push({ input: tiles.get("casing-ud"), top: topoffset, left: (width - 1) * tile_size });
        }
        if (tiles.has(conf.substring(i, i + 1))){
            internals_composite.push({ input: tiles.get(conf.substring(i, i + 1)), top: topoffset, left: (i % (width - 2) + 1) * tile_size });
        }else{
            internals_composite.push({ input: tiles.get("unknown"), top: topoffset, left: (i % (width - 2) + 1) * tile_size });
        }
    }
    for (let i = 0; i < width - 2; i++) {
        internals_composite.push({ input: tiles.get("casing-lr"), top: (height - 1) * tile_size, left: (i * tile_size) + tile_size });
    }
    internals_composite.push({ input: tiles.get("casing-corner"), top: (height - 1) * tile_size, left: 0 });
    internals_composite.push({ input: tiles.get("casing-corner"), top: (height - 1) * tile_size, left: (width - 1) * tile_size });
    return await sharp("./garbage.png")
        .resize(width * tile_size, height * tile_size)
        .composite(internals_composite)
        .png()
        .toBuffer();
}

let inittestrun = false;
async function updateloop() {
    while (true) {
        if (((new Date(Date.now())).getMinutes() % 30 == 0 && Date.now() - last_update > 1000 * 60 * 20) || (inittestrun == false && testing)) {
            inittestrun = true;
            last_update = Date.now();
            const stats = getHighestStats();
            let buildgraphoutput = await buildgraph("output", 1000);
            if (!buildgraphoutput && (!sent_convergence_message)) {
                console.log("False from buildgraph so no changes in files!");
                await spamchan.send("No changes since last update. Convergence is likely!\nView the last update to see the latest.\n<@" + users_to_notify_upon_completion.join("><@") + ">");
                sent_convergence_message = true;
                continue;
            } else if (buildgraphoutput && sent_convergence_message) {
                sent_convergence_message = false;
            }
            console.log("Drawing reactor images...");
            const timestart_reactor_draw = Date.now();
            fs.writeFileSync("./visualizations/reactor.png", await drawReactor(highestconf));
            fs.writeFileSync("./../../../reactorimagesaves/reactor_" + last_max_iteration + ".png", await drawReactor(highestconf));
            console.log(`   Reactor draw complete! ${Date.now() - timestart_reactor_draw}`);
            console.log("Assembling embed and sending...");
            const timestart_embed_send = Date.now();
            const theEmbed = new EmbedBuilder()
                .setTitle("Your bihourly reactor update!")
                .setColor('#DFFF00')
                .setDescription("I maeked dis:" + ((reactor_width <= sidohorg_reactor_bounds["width"] && reactor_length <= sidohorg_reactor_bounds["width"] && reactor_length <= sidohorg_reactor_bounds["height"]) ? `\n[View on br.sidoh.org](https://br.sidoh.org/#reactor-design?length=${reactor_length - 2}&width=${reactor_width - 2}&height=${reactor_height - 2}&activelyCooled=false&controlRodInsertion=0&layout=${compressConf(highestconf)})` : ""))
                .setImage("attachment://output.png")
                .setThumbnail("attachment://reactor.png")
                .addFields(
                    { name: "Generation", value: `${floatRound(stats["output"]["avg"] / 1000, 2)} ±${floatRound(stats["output"]["stdev"] / 1000, 2)} kRF/t`, inline: true },
                    { name: "Consumption", value: `${floatRound(stats["fuelConsumption"]["avg"], 2)} ±${floatRound(stats["fuelConsumption"]["stdev"], 2)} mB/t`, inline: true },
                    { name: "Iteration", value: `${maxx}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'I will continue spamming this until I get it right', iconURL: 'https://cdn.discordapp.com/attachments/985240563131506818/986367128674377758/unknown.png' });
            try {
                await spamchan.send({ content: (`${Math.floor((Date.now() - last_update) / 1000)} seconds ${reactor_width}x${reactor_length}`), embeds: [theEmbed], files: ["./visualizations/output.png", "./visualizations/reactor.png"] });
            } catch {
                const theFallbackEmbed = new EmbedBuilder()
                    .setTitle("Your bihourly reactor update!")
                    .setColor('#DFFF00')
                    .setDescription("Thumbnail was too big or some other stupid excuse by discord:")
                    .setImage("attachment://output.png")
                    .addFields(
                        { name: "Generation", value: `${floatRound(stats["output"]["avg"] / 1000, 3)} ±${floatRound(stats["output"]["stdev"] / 1000, 3)} kRF/t`, inline: true },
                        { name: "Consumption", value: `${floatRound(stats["fuelConsumption"]["avg"], 3)} ±${floatRound(stats["fuelConsumption"]["stdev"], 3)} mB/t`, inline: true },
                        { name: "Iteration", value: `${maxx}`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'I will continue spamming this until I get it right', iconURL: 'https://cdn.discordapp.com/attachments/985240563131506818/986367128674377758/unknown.png' });
                await spamchan.send({ content: (`${Math.floor((Date.now() - last_update) / 1000)} seconds ${reactor_width}x${reactor_length}`), embeds: [theFallbackEmbed], files: ["./visualizations/output.png"] });
            }

            try { //https://stackoverflow.com/a/30654451
                if (global.gc) { global.gc(); }
            } catch (e) {
                console.log("`node --expose-gc index.js`");
                process.exit();
            }
            console.log(`   Embed send complete! ${Date.now() - timestart_embed_send}`);
            if (testing) {
                console.log("Test complete, exiting!");
                return;
            }
        }
        await sleep(1000);
    }
}


function getHighestStats(file = "current.json") {
    let data = JSON.parse(fs.readFileSync("../../../reactorsaves/" + file, { encoding: "utf-8" }));
    let highestpower = 0;
    let highestpowerstats = {};
    for (let conf of Object.keys(data)) {
        if (data[conf]["stats"]["output"]["avg"] > highestpower) {
            highestpower = data[conf]["stats"]["output"]["avg"];
            highestconf = conf;
            highestpowerstats = {};
            Object.assign(highestpowerstats, data[conf]["stats"]);
        }
    }
    console.log(JSON.stringify(highestpowerstats, null, 2));
    return highestpowerstats;
}


async function buildgraph(stat = "output", last_iterations = 400) {
    const fullstart = Date.now();
    let svgelms = [];
    let miny = Infinity;
    let maxy = 0;
    let files = fs.readdirSync("../../../reactorsaves").filter(thing => !["current.json", "final.json"].includes(thing)).sort((a, b) => { return parseInt(a.replace(".json", "")) - parseInt(b.replace(".json", "")) }).slice(-last_iterations);
    maxx = parseInt(files[files.length - 1].replace(".json", ""));
    if (maxx == last_highest_file_iteration) {
        console.log("No additional data found. Skipping this update.");
        return false;
    }
    last_highest_file_iteration = maxx;
    let minx = parseInt(files[0].replace(".json", ""));
    if (last_max_iteration === 0) {
        last_max_iteration = minx;
        last_max_iteration_high_stats = getHighestStats(files[0]);
    }
    let relations = new Map(); // [hash,{"ancestor":hash, "color":color}]
    //sweep files once to get bounds
    let files_parsed = 0;
    //const files_length = files.length;
    let filebatch = [];
    for (let file of files) {
        if (filebatch.length >= 500) {
            await Promise.all(filebatch);
            filebatch = [];
        }
        filebatch.push(parsefile(file));
    }
    async function parsefile(file) {
        try {
            files_parsed++;
            //const this_file_parse = files_parsed;
            let data = JSON.parse(fs.readFileSync("../../../reactorsaves/" + file));
            let iteration = parseInt(file.replace(".json", ""));
            let confbatch = [];
            //const conflength = Object.keys(data).length;
            for (let conf of Object.keys(data)) {
                confbatch.push(parseconf(conf));
            }
            await Promise.all(confbatch);
            async function parseconf(conf) {
                //const startConfTime = Date.now();
                //const thisconfid = confbatch.length;
                //let thisone = conf;
                //let ancestor = data[conf]["ancestor"];
                let thisone = (new mh(666)).update(conf).digest();
                let ancestor = (new mh(666)).update(data[conf]["ancestor"]).digest();
                let stats = {};
                Object.assign(stats, data[conf]["stats"][stat]);
                data[conf] = null;
                delete data[conf];
                const objkeystart = Date.now();
                if (!relations.has(thisone)) {
                    relations.set(thisone, {
                        "ancestor": ancestor,
                        "color": ("#" + Math.floor(Math.random() * 16777215).toString(16)),
                        "coords": [[
                            iteration,
                            stats["avg"] + 0,
                            file
                        ]]
                    });
                } else {
                    relations.get(thisone)["coords"].push([
                        iteration,
                        stats["avg"] + 0,
                        file
                    ])
                }
                //console.log("   objkeydelta = " + (Date.now() - objkeystart) + " ms");
                if (stats["avg"] < miny) {
                    miny = stats["avg"] + 0;
                }
                if (stats["avg"] > maxy) {
                    maxy = stats["avg"] + 0;
                }
                stats = null;
                //console.log(`${thisone} (${this_file_parse}/${files_length}) (${Date.now() - startConfTime} ms) (${thisconfid}/${conflength})`);
            }
            data = null;
            //console.log(`Completed parsing ${file} (${this_file_parse}/${files_length})`);
        } catch (err) {
            console.log("EVIL EVIL EVIL EVIL EVIL: " + file + "\n   " + err.toString());
            fs.writeFileSync("./visualizations/bad_files/" + Date.now(), "EVIL EVIL EVIL EVIL EVIL: " + file, { encoding: "utf-8" });
        }
    }
    console.log(`-- Parsing complete, moving to building (${Date.now() - fullstart} ms)`);
    //sweep again to build the data
    let relations_built = 0;
    const relations_length = relations.size;
    svgelms.push(`
        <rect width="${image_width + image_margins["left"] + image_margins["right"]}" height="${image_height + image_margins["top"] + image_margins["bottom"]}" fill="black" fill-opacity="1" />
    `);
    svgelms.push(`
        <ellipse cx="${getx((last_max_iteration))}" cy="${gety(last_max_iteration_high_stats[stat]["avg"])}" rx="${point_radius * 10}" ry="${Math.round(((last_max_iteration_high_stats[stat]["stdev"]) / (maxy - miny)) * image_height)}" fill="#520000" />
        <line x1="${getx(minx)}" y1="${gety(last_max_iteration_high_stats[stat]["avg"])}" x2="${getx(maxx)}" y2="${gety(last_max_iteration_high_stats[stat]["avg"])}" stroke-width="${Math.ceil(point_radius * 4)}" stroke="#FF0000" />
        <line x1="${getx(last_max_iteration)}" y1="${gety(miny)}" x2="${getx(last_max_iteration)}" y2="${gety(maxy)}" stroke-width="${Math.ceil(point_radius * 4)}" stroke="#FF0000" />
        <circle cx="${getx((last_max_iteration))}" cy="${gety(last_max_iteration_high_stats[stat]["avg"])}" r="${point_radius * 4}" fill="#FF0000" />`
    );
    relations.forEach((relation, relation_ref, relations_map) => {
        relation["coords"].sort((a, b) => { return a[0] - b[0] });
        for (let coord of relation["coords"]) {
            svgelms.push(`
                <circle cx="${getx(coord[0])}" cy="${gety(coord[1])}" r="${point_radius}" fill="${relation["color"]}" />
            `)
        }
        let start_coord = relation["coords"][0];
        let end_coord = relation["coords"][relation["coords"].length - 1];
        svgelms.push(`
            <line x1="${getx(start_coord[0])}" y1="${gety(start_coord[1])}" x2="${getx(end_coord[0])}" y2="${gety(end_coord[1])}" stroke-width="${Math.ceil(point_radius / 1.2)}" stroke="${relation["color"]}" />
        `)
        if (start_coord[1] != end_coord[1]) {
            console.log(`What happened here:\nstart = (${getx(start_coord[0])}, ${gety(start_coord[1])})\nstart = (${getx(end_coord[0])}, ${gety(end_coord[1])})`);
        }
        /*if (relations.has(relation["ancestor"])) {
            let end_ancestor = relations.get(relation["ancestor"])["coords"][relations.get(relation["ancestor"])["coords"].length - 1];
            svgelms.push(`
                <line x1="${getx(start_coord[0])}" y1="${gety(end_ancestor[1])}" x2="${getx(start_coord[0])}" y2="${gety(start_coord[1])}" stroke-width="${Math.ceil(point_radius / 4)}" stroke="${relation["color"]}" />
            `)
        }*/
        relations_built++;
        //console.log(`built ${relation_ref} (${relations_built}/${relations_length})`);
    });
    console.log(`-- Building complete, moving to export (${Date.now() - fullstart} ms)`);
    let fullsvg = `<svg>${svgelms.join("")}</svg>`;
    fs.writeFileSync("./visualizations/" + stat + ".png", await sharp(Buffer.from(fullsvg), { unlimited: true }).png().toBuffer());
    function getx(rawx) {
        rawx = rawx < minx ? minx : rawx;
        rawx = rawx > maxx ? maxx : rawx;
        return Math.round(((rawx - minx) / (maxx - minx)) * image_width + image_margins["left"]);
    }
    function gety(rawy) {
        rawy = rawy < miny ? miny : rawy;
        rawy = rawy > maxy ? maxy : rawy;
        return image_height + image_margins["top"] - Math.round(((rawy - miny) / (maxy - miny)) * image_height);
    }
    console.log(`   Export complete! (${Date.now() - fullstart} ms)`);
    last_max_iteration = maxx;
    last_max_iteration_high_stats = getHighestStats(files[files.length - 1]);
    relations = null;
    return true;
}
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function compressConf(input) { //Thanks ChatGPT :)
    let output = "";
    let count = 1;
    for (let i = 0; i < input.length; i++) {
        if (input[i] === input[i + 1]) {
            count++;
        } else {
            output += count > 1 ? count + input[i] : input[i];
            count = 1;
        }
    }
    return output;
}
function floatRound(number, digits) { //https://chat.openai.com/chat
    return number.toFixed(digits).toString();
}