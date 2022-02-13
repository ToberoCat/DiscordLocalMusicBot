const { client } = require("../index");

client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd)
            return interaction.followUp({ content: "An error has occured " });

        const args = []
        interaction.options.data.forEach(option => {
            args.push(option.value)
        });

        cmd.slashCommand(interaction, args);
    }
});