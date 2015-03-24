module.exports = function (coin, ircClient, settings) {

    return {
        run: function help(from, channel, message) {
            var match = message.match(/^(\W?)(\S+)/);
            if(match == null) return;
            var prefix  = match[1];
            var command = match[2];

            var msg = [];
            for(var i = 0; i < settings.messages[command].length; i++) {
                ircClient.say(from, settings.messages[command][i].expand({}));
            }
        },
        commands: ['help', 'terms', 'donate']
    };

};
