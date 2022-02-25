const { SlashCommandBuilder } = require('@discordjs/builders');
const { audio, client, config } = require("../../index");
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const play = require('play-dl');

const name = "play";
const description = "Play a song from music";

const youtubeURLRegex = /^[a-zA-Z0-9-_]{11}$/;

module.exports = {
    name,
    description,
    builder: new SlashCommandBuilder().setName(name).setDescription(description).addStringOption(option =>
            option.setName("song").setDescription("The song name").setRequired(true)),
    slashCommand(interaction, args) {
        const channel = client.channels.cache.get(interaction.channelId);
        execute(args, channel, interaction.member).then(async (response, err) => {
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
    const query = args.join(" ").split("&list=")[0];
    let url = "";
    if (youtubeURLRegex.test(query)) {
        url = query;
    } else {
        const search = await play.search(query, {
            limit: 1
        });

        if (search == null) {
            return { embeds: [ new MessageEmbed().setTitle("Couldn't find song")
                    .setDescription(`The song ${query} you were searching for wasn't found `) ] };
        }
        url = search[0].url;
    }

    return audio.playSong(url, channel, member);
}
