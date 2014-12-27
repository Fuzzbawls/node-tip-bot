var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function address(from, channel, message) {
        var user = from.toLowerCase();

        logger.debug('Requesting address for %s', user);
        coin.send('getaccountaddress', user, function(err, address) {
            if(err) {
                logger.error('Something went wrong while getting address. ' + err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                callback(err);
                return false;
            }

            ircClient.say(channel, settings.messages.deposit_address.expand({name: user, address: address}));
            callback(false, address);
        });
    }
};
