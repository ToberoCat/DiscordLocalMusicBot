const { client } = require("../index");

client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
        await interaction.deferReply({ ephemeral: true });
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd)
            return interaction.followUp({ content: "An error has occured " });

        const args = []
        interaction.options.data.forEach(option => {
            args.push(option.value)
        });

        cmd.slashCommand(interaction, args);
    } else if (interaction.isButton()) {
        await interaction.deferReply({ ephemeral: true });
        const cmd = client.commands.get(interaction.customId);

        if (!cmd)
            return interaction.followUp({ content: "An error has occured " });

        cmd.slashCommand(interaction, []);
    }
});