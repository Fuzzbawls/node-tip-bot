var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function total(from, channel, message) {
        if (settings.admin && from.toLowerCase() !== settings.admin.toLowerCase()) {
            ircClient.say(channel, 'Sorry, you have no permissions to execute this command.');
            return;
        }

        coin.getInfo(function(err, info) {
            if(err) {
                logger.error('Error in !total command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }

            ircClient.say(channel, settings.messages.total.expand({
                total: info.balance
            }));
        });
    }
};
