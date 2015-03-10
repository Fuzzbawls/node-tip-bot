var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function height(from, channel, message) {
        coin.getMiningInfo(function(err, info) {
            if(err) {
                logger.error('Error in !height command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }

            ircClient.say(channel, settings.messages.height.expand({
                height: info.blocks
            }));
        });
    }
};
