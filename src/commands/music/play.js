const { SlashCommandBuilder } = require('@discordjs/builders');
const { audio, client } = require("../../index");
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");

const name = "play";
const description = "Play a song from music";

module.exports = {
    name,
    description,
    builder: new SlashCommandBuilder().setName(name).setDescription(description).addStringOption(option => {
            option.setName("song").setDescription("The song name").setRequired(true);
            audio.availableSongs.forEach((value, key) => {
                option.addChoice(key, key);
            });

            return option
    }),
    slashCommand(interaction, args) {
        const channel = client.channels.cache.get(interaction.channelId);
        execute(args, channel, interaction.member).then(async (response, err) => {
            if (err) return console.error(err);

            interaction.reply(response);
        });
    },
    messageCommand(message, args) {
        execute(args, message.channel, message.member).then(async (response, err) => {
            if (err) return console.error(err);

            await message.channel.send(response);
        });
    }
}

async function execute(args, channel, member) {
    const query = args.join(" ");
    if (audio.availableSongs.has(query)) {
        return audio.playSong(query, channel, member);
    } else {
        const embed = new MessageEmbed()
            .setTitle("Didn't find song")
            .setDescription(`Song ${query} wasn't found in the music registry`)
            .setColor("#ED4245");
        return { embeds: [ embed ] };
    }
}
