module.exports = function (coin, ircClient, settings) {
    return function help(from, channel, message) {
        // comands that don't require identifying
        var match = message.match(/^(!?)(\S+)/);
        if(match == null) return;
        var prefix  = match[1];
        var command = match[2];

        if(command == 'help' || command == 'terms') {
            var msg = [];
            for(var i = 0; i < settings.messages[command].length; i++) {
                ircClient.say(from, settings.messages[command][i].expand({}));
            }

            return;
        }
    }
};
