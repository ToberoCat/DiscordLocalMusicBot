const { MessageActionRow, MessageButton, MessageEmbed} = require('discord.js');
const JSON5 = require("json5");
const fs = require("fs");

let messages;

function load_msg() {
    messages = JSON5.parse(fs.readFileSync("../localization/messages.json").toString());
}

function getEmbed(id, parsables) {
    load_msg();
    const embed = messages[id];
    embed.timestamp = new MessageEmbed().setTimestamp().toJSON().timestamp;
    if (parsables != null) {
        parsables.forEach((parser) => {
            if (embed.title) embed.title = embed.title.replaceAll(`{${parser.from}}`, parser.to);
            if (embed.thumbnail) embed.thumbnail.url = embed.thumbnail.url.replaceAll(`{${parser.from}}`, parser.to);
            if (embed.description) embed.description = embed.description.replaceAll(`{${parser.from}}`, parser.to);
            if (embed.image) embed.image.url = embed.image.url.replaceAll(`{${parser.from}}`, parser.to);
            if (embed.footer) embed.footer = embed.footer.replaceAll(`{${parser.from}}`, parser.to);
            if (embed.url) embed.url = embed.url.replaceAll(`{${parser.from}}`, parser.to);
        });
    }

    return embed;

}

module.exports.getEmbed = getEmbed;