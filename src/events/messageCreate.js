const { client, config } = require("../index");

client.on('messageCreate', async message => {
    const prefix = config.prefix;
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    client.commands.forEach(cmd => {
        if (command === cmd.name) {
            cmd.messageCommand(message, args);
        }
    });
});