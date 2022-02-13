const mm = require('music-metadata');
const util = require('util');

(async () => {
    try {
        const metadata = await mm.parseFile('C:\\TestMusic\\Playlist\\Franzl Lang.mp3');
        console.log(metadata.common.);
    } catch (error) {
        console.error(error.message);
    }
})();