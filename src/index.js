const { Client, Collection, Intents} = require("discord.js");
const JSON5 = require("json5");
const fs = require("fs");
const AudioManager = require("./audio/AudioManager");

const config = JSON5.parse(fs.readFileSync("./config.json5"));

const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.DIRECT_MESSAGES],
    partials: ['CHANNEL', 'MESSAGE']
});

const audio = new AudioManager(config);

client.once("ready", async () => {
    client.commands = new Collection();
    const guilds = client.guilds.cache.size;
    await require("./handler/Handler")(client, config);

    console.log(`Ready! Logged in as ${client.user.tag}! I'm on ${guilds} ${guilds === 1 ? "guild" : "guilds"}`);
});

client.login(process.env.BOT_TOKEN || config.botToken);

module.exports.client = client;
module.exports.config = config;
module.exports.audio = audio;
