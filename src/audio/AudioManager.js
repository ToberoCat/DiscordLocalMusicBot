const { MessageActionRow, MessageButton, MessageEmbed} = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior,
    AudioPlayerStatus
} = require("@discordjs/voice");
const { getEmbed } = require("../language/Language");
const { video_info, stream } = require("play-dl");
const youtubeThumbnail = require("youtube-thumbnail");

class AudioManager {
    constructor(config) {
        this.queue = new Map();
        this.config = config;
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
        const connection = await this.connect(member);

        if (connection === "NOT_CONNECTED") {
            return { embeds: [ getEmbed("no-connection") ] }
        }

        const guildId = messageChannel.guild.id;
        const info = await video_info(url);

        if (this.queue.has(guildId)) {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue.messageChannel.id !== messageChannel.id) {
                const embed = getEmbed("other-channel-in-use", [{from: "messageChannel",to: guildQueue.messageChannel.toString() } ])
                return { embeds: [ embed ] };
            } else {
                const position = this.queue.get(guildId).songQueue.push(url);
                const embed = getEmbed("added-to-queue", [{from: "position",to: position },
                    {from: "song", to: info.video_details.title} ])
                return { embeds: [ embed ] };
            }
        } else {
            this.createQueue(guildId, url, messageChannel, connection, member);
            return await this.play(guildId);
        }
    }

    createQueue(guildId, filePath, messageChannel, connection, member) {
        const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });

        player.on(AudioPlayerStatus.Idle, async () => {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue == null) return;

            guildQueue.cachedPlaying = guildQueue.playing;
            if (guildQueue.songQueue.length > 0 || guildQueue.loop) {
                guildQueue.messageChannel.send(await this.play(guildId)).then(message => {
                    setTimeout(() => {
                        message.delete();
                    }, 30000);
                });
            } else {
                guildQueue.playing = "";
                guildQueue.timeoutID = setTimeout(async () => {
                    this.queue.delete(guildId);
                }, 200);
            }

        });
        player.on(AudioPlayerStatus.Playing, async () => {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue == null) return;
            guildQueue.playing = guildQueue.cachedPlaying;
            guildQueue.cachedPlaying = "";
            clearTimeout(guildQueue.timeoutID);
        });

        connection.subscribe(player);
        this.queue.set(guildId, {
            messageChannel: messageChannel,
            connection: connection,
            voiceChannelId: member.voice.channelId,
            player: player,
            resource: undefined,
            loop: false,
            playing: "",
            cachedPlaying: "",
            timeoutID: -1,
            songQueue: [ filePath ],
        });
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
            this.queue.delete(guildId);

            return { embeds: [ getEmbed("no-song-in-queue") ] }
        }

        const audioStream = await stream(nextSong);
        guildQueue.resource = createAudioResource(audioStream.stream, {
            inputType: audioStream.type
        })

        if (this.config.isFFmpegInstalled) {
            guildQueue.player.play(guildQueue.resource, {inlineVolume: true});
        } else {
            guildQueue.player.play(guildQueue.resource);
        }
        const info = await video_info(nextSong);
        const thumbnail = youtubeThumbnail(nextSong);

        guildQueue.playing = nextSong;
        const embed = getEmbed("next-song-playing", [
            {from: "song", to: info.video_details.title},
            {from: "song.url", to: nextSong},
            {from: "song.thumbnail", to: thumbnail.high.url}
        ]);

        return { embeds: [ embed ], components: [ this.getRow(guildId) ]}
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
        if (!member.voice.channel) return { embeds: [ getEmbed("no-connection") ] };

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