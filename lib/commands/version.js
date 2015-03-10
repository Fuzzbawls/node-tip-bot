var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function version(from, channel, message) {
        coin.getInfo(function(err, info) {
            if(err) {
                logger.error('Error in !version command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }

            ircClient.say(channel, settings.messages.version.expand({
                version: info.version,
                protocolversion: info.protocolversion,
                walletversion: info.walletversion
            }));
        });
    }
};
