# DiscordLocalMusicBot
A discord bot for playing msuci stored in on your computer

Setup:
Clone this repository by clicking Code > Download ZIP
Extract to your computer

Installation:
Requires: NodeJsv17.4.0 or later - If not installed follow steps below or download it from https://nodejs.org/en/
Run install_windows.bat if you are on windows, install_linux.sh if you are on linux

Go to src/config.json5 and in there is everything you need for running this bot

Create a discord bot application under https://discord.com/developers/applications and then invite the bot using https://discordapi.com/permissions.html

Starting:
Execute the start.bat on windows, start.sh on linux

Usage:
All commanda are useable as / or prefix (By default m.)

/play <Songname> - This will search on youtube if no valid link is provided
/stop - Stop the music
/skip - Skip the song. Wont resume if paused
/pause - Pause the song
/resume - Resume the song
/leave - Leave the channel
/loop - Loop the current playing song
