const { MessageActionRow, MessageButton, MessageEmbed} = require('discord.js');

const embed = new MessageEmbed().setTimestamp().setImage("http://img.youtube.com/vi/bESGLojNYSo/hqdefault.jpg");

console.log(embed.toJSON())