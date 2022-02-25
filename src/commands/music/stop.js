const { SlashCommandBuilder } = require('@discordjs/builders');
const { audio, client, config} = require("../../index");
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");

const name = "stop";
const description = "Stop the bot from playing";

module.exports = {
    name,
    description,
    builder: new SlashCommandBuilder().setName(name).setDescription(description),
    slashCommand(interaction, args) {
        const channel = client.channels.cache.get(interaction.channelId);
        execute(args, channel, interaction.member).then((response, err) => {
            if (err) return console.error(err);

            interaction.editReply(response);
        });
    },
    messageCommand(message, args) {
        execute(args, message.channel, message.member).then(async (response, err) => {
            if (err) return console.error(err);

            const sent = await message.channel.send(response);
            setTimeout(() => {
                sent.delete();
            }, config.messageDeletion);
        });
    }
}

async function execute(args, channel, member) {
    return audio.stop(channel, member);
}
