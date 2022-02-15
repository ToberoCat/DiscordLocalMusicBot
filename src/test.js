const {video_info} = require("play-dl");
const youtubeThumbnail = require('youtube-thumbnail');

(async () => {
    const thumbnail = youtubeThumbnail('https://www.youtube.com/watch?v=9bZkp7q19f0');
    console.log(thumbnail.high.url);
})();
