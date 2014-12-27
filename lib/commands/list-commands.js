var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    var listCommands = {
        run: function (from, channel, message) {
            var commands = require('../../tipbot').commands;
            var resp = JSON.stringify(Object.keys(commands));
            ircClient.say(channel, resp);
        },
        commands: ['listcommands']
    };

    return listCommands;
};
