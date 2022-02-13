const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior,
    AudioPlayerStatus
} = require("@discordjs/voice");
const fs = require("fs");
const mm = require('music-metadata');
const path = require("path");

class AudioManager {
    constructor(config) {
        this.queue = new Map();
        this.availableSongs = new Map();
        this.availablePlaylists = new Map();
        const musicPath = config.musicPath;
        fs.readdir(musicPath, (err, files) => {
           files.forEach(file => {
               const pathToFile = `${musicPath}/${file}`;
               if (fs.lstatSync(pathToFile).isDirectory()) {
                   this.availablePlaylists.set(file, this.scanPlaylist(pathToFile))
               } else {
                   if (file.length >= 100) {
                       console.log(`Warning: ${file} in ${musicPath}. The filename is too long. Names must not be longer than 100 charcters`)
                       return;
                   }
                   this.availableSongs.set(file, pathToFile);
               }
           });
        });

    }
    scanPlaylist(filePath) {
        const songs = new Map();
        const files = fs.readdirSync(filePath);

        files.forEach(file => {
            if (file.length >= 100) {
                console.log(`Warning: ${file} in ${filePath}. The filename is too long. Names must not be longer than 100 charcters`)
                return;
            }
            const pathToFile = `${filePath}/${file}`;
            if (!fs.lstatSync(pathToFile).isDirectory()) {
                songs.set(file, pathToFile);
                this.availableSongs.set(file, pathToFile);
            }
        });

        return songs;
    }

    async connect(member) {
        if (!member.voice.channel) return "NOT_CONNECTED";
        const connection = await joinVoiceChannel({
            channelId: member.voice.channelId,
            guildId: member.voice.channel.guildId,
            adapterCreator: member.voice.channel.guild.voiceAdapterCreator
        });

        return connection;
    }

    async playSong(songQuery, messageChannel, member) {
        const embed = new MessageEmbed().setColor("#1ED760").setTimestamp();

        const connection = await this.connect(member);

        if (connection === "NOT_CONNECTED") {
            embed.setColor("#ED4245").setTitle("You are in no voice channel").setDescription("You need to connecto to a voice channel to use this command");
            return { embeds: [ embed ] }
        }

        const guildId = messageChannel.guild.id;
        const filePath = this.availableSongs.get(songQuery);
        const info = await mm.parseFile(filePath);

        if (this.queue.has(guildId)) {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue.messageChannel.id !== messageChannel.id) {
                embed.setColor("#ED4245").setTitle("Can't use this channel")
                    .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            } else {
                const position = this.queue.get(guildId).songQueue.push(filePath);
                embed.setTitle(`Added ${info.common.title} to server queue`)
                    .setDescription(`Current position: ${position}`);
            }
        } else {
            this.createQueue(guildId, filePath, messageChannel, connection, member);
            return await this.play(guildId);
        }

        return { embeds: [embed] };
    }

    createQueue(guildId, filePath, messageChannel, connection, member) {
        const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

        player.on(AudioPlayerStatus.Idle, async () => {
            const guildQueue = this.queue.get(guildId);
            if (guildQueue == null) return;

            guildQueue.messageChannel.send(await this.play(guildId));
        });

        connection.subscribe(player);
        this.queue.set(guildId, {
            messageChannel: messageChannel,
            message: null,
            connection: connection,
            voiceChannelId: member.voice.channelId,
            player: player,
            loop: false,
            playing: "",

            songQueue: [ filePath ],
        });
    }

    setMessage(message) {
        const guildQueue = this.queue.get(message.guildId);
        guildQueue.message = message;
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
            return { embeds: [ new MessageEmbed().setColor("#ED4245").setTitle("Left because no song was in queue").setTimestamp() ]}
        }

        const resource = createAudioResource(path.resolve(nextSong));
        guildQueue.player.play(resource);
        const info = await mm.parseFile(nextSong);

        const title = info.common.title ? info.common.title : "No title set for this song";

        guildQueue.playing = nextSong;

        return { embeds: [ new MessageEmbed().setColor("#1ED760").setTitle(`Now playing: ${title}`)
                .setDescription(`Song is ${await this.getLength(nextSong)} long`).setTimestamp() ]}
    }

    formatDuration(duration) {
        let seconds = ""+Math.round(duration % 60);
        if (seconds.length === 1) seconds = `0${seconds}`;

        return `${Math.floor(duration / 60)}:${seconds} min`;
    }

    async getLength(filePath) { return this.formatDuration(await this.getRawLength(filePath)); }
    async getRawLength(filePath) {
        const info = await mm.parseFile(filePath);

        return info.format.duration;
    }

    async playPlaylist(playlistQuery, messageChannel, member) {
        if (!member.voice.channel) return { embeds: [ new MessageEmbed().setTimestamp().setColor("#ED4245")
                .setTitle("You are in no voice channel")
                .setDescription("You need to connect to a voice channel to use this command") ] };


        const playlist = this.availablePlaylists.get(playlistQuery);
        const guildId = messageChannel.guild.id;


        const queued = this.queue.has(guildId) && this.queue.get(guildId).songQueue.length > 0;
        const embed = new MessageEmbed().setColor("#1ED760").setTitle(queued ? `Added ${playlistQuery} to server queue` :
            `Now playing ${playlistQuery}`);


        const guildQueue = this.queue.get(guildId);
        if (queued && guildQueue.messageChannel.id !== messageChannel.id) {
            embed.setColor("#ED4245").setTitle("Can't use this channel")
                    .setDescription(`Another channel, because it's already in use. Please go to ${guildQueue.messageChannel}`);
            return { embeds: [ embed ] };
        }

        let totalPlaytime = 0;

        for (let entry of playlist.entries()) {
            const key = entry[0], value = entry[1];
            await this.playSong(key, messageChannel, member);
            const duration = await this.getRawLength(value);
            totalPlaytime += duration;
            embed.addField(key, `Song does take ${this.formatDuration(duration)}`, true);
        }

        embed.setDescription(`Your playlist will take ${this.formatDuration(totalPlaytime)}. All added songs will get listed below`)

        return {embeds: [ embed ] };
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