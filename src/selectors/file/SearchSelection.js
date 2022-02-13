const { audio } = require("../../index");
const { playSongByURL } = require("../../commands/music/play");
module.exports = (interaction) => {
    interaction.reply({ content: "Halo " })
    audio.playSong(interaction.values[0], interaction.message.channel, interaction.member).then((response) => {
       //interaction.reply(response);
    });
    //interaction.message.delete();
}