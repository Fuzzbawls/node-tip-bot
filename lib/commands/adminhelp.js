module.exports = function (coin, ircClient, settings) {
    return function adminhelp(from, channel, message) {
        if (settings.admin && from.toLowerCase() !== settings.admin.toLowerCase()) {
            ircClient.say(channel, 'Sorry, you have no permissions to execute this command.');
            return;
        }
        // comands that don't require identifying
        var match = message.match(/^(.?)(\S+)/);
        if(match == null) return;
        var prefix  = match[1];
        var command = match[2];

        if(command == 'adminhelp') {
            var msg = [];
            for(var i = 0; i < settings.messages[command].length; i++) {
                ircClient.say(from, settings.messages[command][i].expand({}));
            }

            return;
        }
    }
};
