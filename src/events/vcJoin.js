const { client, config } = require("../index");
const {getEmbed} = require("../language/Language");

client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (!config.friends.includes(newMember.id)) return;
    let newUserChannel = newMember.channelId;

    if (newUserChannel != null) { // Joined
        let mention = "";
        config.friends.forEach((friend) => {
            if (friend === newMember.id) return;
            mention += "<@" + friend + "> ";
        });
        const embed = getEmbed("vc-join", [
            {from: "channel", to: newMember.channel.name},
            {from: "user", to: newMember.member.displayName},
            {from: "friend_mentions", to: mention}
        ]);
        const channel = client.channels.cache.find(x => x.id == config.notificationChannel);
        if (!channel) return;
        channel.send({embeds: [embed]})
    }
});