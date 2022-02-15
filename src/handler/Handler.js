const { glob } = require("glob");
const { promisify } = require("util");

const globPromise = promisify(glob);

const buttons = new Map();

module.exports = async (client, config) => {
    // Commands
    const commandFiles = await globPromise(`${process.cwd()}/commands/**/*.js`);
    const commands = [];
    commandFiles.map((value) => {
        const file = require(value);
        const splitted = value.split("/");
        const directory = splitted[splitted.length - 2];

        if (file.name) {
            const properties = { directory, ...file };
            client.commands.set(file.name, properties);

            commands.push(file.builder);
        }
    });

    // Events
    const eventFiles = await globPromise(`${process.cwd()}/events/*.js`);
    eventFiles.map((value) => require(value));

    //Load slash commands
    if (config.useGlobalCommands) {
        await client.applications.commands.set();
    } else {
        await client.guilds.cache.get(config.slashCommandGuild).commands.set(commands);
    }
}