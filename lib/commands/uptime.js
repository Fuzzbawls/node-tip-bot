var logger = require('winston');

function pad (s){
    return (s < 10 ? '0' : '') + s;
}

function formatTime (seconds) {
    var hours = Math.floor(seconds / (60*60));
    var minutes = Math.floor(seconds % (60*60) / 60);
    var seconds = Math.floor(seconds % 60);

    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

module.exports = function (coin, ircClient, settings) {
    return function uptime(from, channel, message) {
        var uptime = formatTime(process.uptime());
        ircClient.say(channel, settings.messages.uptime.expand({uptime: uptime}));
    }
};
