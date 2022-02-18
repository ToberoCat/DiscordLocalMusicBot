const { MessageActionRow, MessageButton, MessageEmbed} = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior,
    AudioPlayerStatus
} = require("@discordjs/voice");
const { video_info, stream } = require("play-dl");
const youtubeThumbnail = require("youtube-thumbnail");

class AudioManager {
    constructor() {
        this.queue = new Map();
    }

    async connect(member) {
        if (!member.voice.channel) return "NOT_CONNECTED";
        return joinVoiceChannel({
            channelId: member.voice.channelId,
            guildId: member.voice.channel.guildId,
            adapterCreator: member.voice.channel.guild.voiceAdapterCreator
        });
    }

    async playSong(url, messageChannel, member) {
        const embed = new MessageEmbed().setColor("#1ED760").setTimestamp();

        const connection = await this.connect(member);

        if (connection === "NOT_CONNECTED") {
            embed.setColor("#ED4245").setTitle("You are in no voice channel").setDescription("You need to connecto to a voice channel to use this command");
            return { embeds: [ embed ] }
        }

        const guildId = messageChannel.guild.id;
        const info = await video_info(url);

        if (this.queue.has(guildId)) {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue.messageChannel.id !== messageChannel.id) {
                embed.setColor("#ED4245").setTitle("Can't use this channel")
                    .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
                return { embeds: [embed] };
            } else if (guildQueue.songQueue.length > 0) {
                const position = this.queue.get(guildId).songQueue.push(url);
                embed.setTitle(`Added ${info.video_details.title} to server queue`)
                    .setDescription(`Current position: ${position}`);
                return { embeds: [embed] };
            } else {
                this.createQueue(guildId, url, messageChannel, connection, member);
                return await this.play(guildId);
            }
        } else {
            this.createQueue(guildId, url, messageChannel, connection, member);
            return await this.play(guildId);
        }

        return { embeds: [embed] };
    }

    createQueue(guildId, filePath, messageChannel, connection, member) {
        const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });

        player.on(AudioPlayerStatus.Idle, async () => {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue == null) return;

            if (guildQueue.songQueue.length > 0 || guildQueue.loop) {
                guildQueue.messageChannel.send(await this.play(guildId));
            } else {
                guildQueue.timeoutID = setTimeout(async () => {
                    guildQueue.messageChannel.send(await this.play(guildId));
                }, 60000);
            }

        });
        player.on(AudioPlayerStatus.Playing, async () => {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue == null) return;
            clearTimeout(guildQueue.timeoutID);
        });

        connection.subscribe(player);
        this.queue.set(guildId, {
            messageChannel: messageChannel,
            connection: connection,
            voiceChannelId: member.voice.channelId,
            player: player,
            loop: false,
            playing: "",
            timeoutID: -1,
            songQueue: [ filePath ],
        });
    }

    async setVolume(volume, messageChannel) {
        if (!member.voice.channel) return { embeds: [ new MessageEmbed().setTimestamp().setColor("#ED4245")
                .setTitle("You are in no voice channel")
                .setDescription("You need to connect to a voice channel to use this command") ] };

        const guildQueue = this.queue.get(messageChannel.guild.id);

        if (guildQueue == null) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Bot isn't playing anything");
            return { embeds: [ embed ] };
        }

        if (guildQueue.messageChannel.id !== messageChannel.id) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Can't use this channel")
                .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            return { embeds: [ embed ] };
        }

        guildQueue.connection.setVolume(parseInt(volume));
        const embed = new MessageEmbed().setTimestamp().setColor("#5865F2").setTitle("Changed volume").setDescription(`You changed the volume to ${volume}`);
        return { embeds: [ embed ] };
    }

    async play(guildId) {
        const guildQueue = this.queue.get(guildId);

        let nextSong;
        if (guildQueue.loop) {
            nextSong = guildQueue.playing;
        } else {
            nextSong = guildQueue.songQueue.shift();
        }

        if (nextSong == null) {
            guildQueue.connection.destroy();
            this.queue.delete(guildId);

            const embed = new MessageEmbed().setColor("#ED4245").setTitle("Left because no song was in queue").setTimestamp();
            return { embeds: [ embed ] }
        }
        const audioStream = await stream(nextSong);
        const resource = createAudioResource(audioStream.stream, {
            inputType: audioStream.type
        })
        guildQueue.player.play(resource);
        const info = await video_info(nextSong);
        const thumbnail = youtubeThumbnail(nextSong);

        guildQueue.playing = nextSong;

        return { embeds: [ new MessageEmbed().setColor("#1ED760").setTitle(`Now playing: ${info.video_details.title}`)
                .setDescription(`Go to the [youtube](${nextSong})`).setThumbnail(thumbnail.high.url).setTimestamp() ],
            components: [ this.getRow(guildId) ]}
    }

    getSkipButton() {
        return new MessageButton().setCustomId('skip')
            .setLabel('Skip')
            .setStyle('SECONDARY');
    }
    getStopButton() {
        return new MessageButton().setCustomId('stop')
            .setLabel('Stop')
            .setStyle('DANGER');
    }
    getPauseButton() {
        return new MessageButton().setCustomId('pause')
            .setLabel('Pause')
            .setStyle('SECONDARY');
    }
    getResumeButton() {
        return new MessageButton().setCustomId('resume')
            .setLabel('Resume')
            .setStyle('SECONDARY');
    }
    getLoopButton() {
        return new MessageButton().setCustomId('loop')
            .setLabel('Loop')
            .setStyle('SECONDARY');
    }
    getRow(guildId) {
        return new MessageActionRow().addComponents(this.getSkipButton(), this.getPauseButton(),
            this.getResumeButton(), this.getLoopButton(), this.getStopButton());
    }

    stop(messageChannel, member) {
        if (!member.voice.channel) return { embeds: [ new MessageEmbed().setTimestamp().setColor("#ED4245")
                .setTitle("You are in no voice channel")
                .setDescription("You need to connect to a voice channel to use this command") ] };

        const guildQueue = this.queue.get(messageChannel.guild.id);

        if (guildQueue == null) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("There is nothing to stop")
                .setDescription(`You can't stop me from playing nothing`);
            return { embeds: [ embed ] };
        }

        if (guildQueue.messageChannel.id !== messageChannel.id) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Can't use this channel")
                .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            return { embeds: [ embed ] };
        }

        guildQueue.connection.destroy();
        this.queue.delete(messageChannel.guild.id);
        return { embeds: [ new MessageEmbed().setColor("#5865F2").setTitle("Stopped playing").setTimestamp() ]}
    }
    async skip(messageChannel, member) {
        if (!member.voice.channel) return { embeds: [ new MessageEmbed().setTimestamp().setColor("#ED4245")
                .setTitle("You are in no voice channel")
                .setDescription("You need to connect to a voice channel to use this command") ] };

        const guildQueue = this.queue.get(messageChannel.guild.id);

        if (guildQueue == null) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("There is nothing to skip");
            return { embeds: [ embed ] };
        }

        if (guildQueue.messageChannel.id !== messageChannel.id) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Can't use this channel")
                .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            return { embeds: [ embed ] };
        }
        const looped = guildQueue.loop;
        guildQueue.loop = false;
        guildQueue.player.stop();
        const message = await this.play(messageChannel.guild.id)
        guildQueue.loop = looped;
        return message;
    }
    pause(messageChannel, member) {
        if (!member.voice.channel) return { embeds: [ new MessageEmbed().setTimestamp().setColor("#ED4245")
                .setTitle("You are in no voice channel")
                .setDescription("You need to connect to a voice channel to use this command") ] };

        const guildQueue = this.queue.get(messageChannel.guild.id);

        if (guildQueue == null) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("There is nothing to pause");
            return { embeds: [ embed ] };
        }

        if (guildQueue.messageChannel.id !== messageChannel.id) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Can't use this channel")
                .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            return { embeds: [ embed ] };
        }

        guildQueue.player.pause();
        const embed = new MessageEmbed().setTimestamp().setColor("#5865F2").setTitle("Paused song");
        return { embeds: [ embed ] };
    }
    resume(messageChannel, member) {
        if (!member.voice.channel) return { embeds: [ new MessageEmbed().setTimestamp().setColor("#ED4245")
                .setTitle("You are in no voice channel")
                .setDescription("You need to connect to a voice channel to use this command") ] };

        const guildQueue = this.queue.get(messageChannel.guild.id);

        if (guildQueue == null) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("There is nothing to resume");
            return { embeds: [ embed ] };
        }

        if (guildQueue.messageChannel.id !== messageChannel.id) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Can't use this channel")
                .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            return { embeds: [ embed ] };
        }

        guildQueue.player.unpause();
        const embed = new MessageEmbed().setTimestamp().setColor("#5865F2").setTitle("Resumed song");
        return { embeds: [ embed ] };
    }
    loop(messageChannel, member) {
        if (!member.voice.channel) return { embeds: [ new MessageEmbed().setTimestamp().setColor("#ED4245")
                .setTitle("You are in no voice channel")
                .setDescription("You need to connect to a voice channel to use this command") ] };

        const guildQueue = this.queue.get(messageChannel.guild.id);

        if (guildQueue == null) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Bot isn't playing anything");
            return { embeds: [ embed ] };
        }

        if (guildQueue.messageChannel.id !== messageChannel.id) {
            const embed = new MessageEmbed().setTimestamp().setColor("#ED4245").setTitle("Can't use this channel")
                .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            return { embeds: [ embed ] };
        }

        guildQueue.loop = !guildQueue.loop;
        const embed = new MessageEmbed().setTimestamp().setColor("#5865F2").setTitle(guildQueue.loop ? "Now looping currently playing song" : "Stopped looping currently playing song");
        return { embeds: [ embed ] };
    }
}

module.exports = AudioManager;