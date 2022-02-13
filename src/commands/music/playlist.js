const { SlashCommandBuilder } = require('@discordjs/builders');
const { audio, client } = require("../../index");
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");

const name = "playlist";
const description = "Play a playlist";

module.exports = {
    name,
    description,
    builder: new SlashCommandBuilder().setName(name).setDescription(description).addStringOption(option => {
        option.setName("playlist").setDescription("The playlist name").setRequired(true);
        audio.availablePlaylists.forEach((value, key) => {
            option.addChoice(key, key);
        });

        return option
    }),
    slashCommand(interaction, args) {
        const channel = client.channels.cache.get(interaction.channelId);
        execute(args, channel, interaction.member).then((response, err) => {
            if (err) return console.error(err);

            interaction.reply(response).then((message) => {
                interaction.fetchReply()
                    .then(reply => console.log(`Replied with ${reply.content}`))
                    .catch(console.error);
//                audio.setMessage(message);
            })
        });
    },
    messageCommand(message, args) {
        execute(args, message.channel, message.member).then(async (response, err) => {
            if (err) return console.error(err);

            audio.setMessage(await message.channel.send(response));
        });
    }
}

async function execute(args, channel, member) {
    const query = args.join(" ");
    if (audio.availablePlaylists.has(query)) {
        return await audio.playPlaylist(query, channel, member);
    } else {
        const embed = new MessageEmbed()
            .setTitle("Didn't find playlist")
            .setDescription(`Playlist ${query} wasn't found in the music registry`)
            .setColor("#ED4245");
        return { embeds: [ embed ] };
    }
}
