var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function balance(from, channel, message) {
        var user = from.toLowerCase();
        coin.getBalance(user, settings.coin.min_confirmations, function(err, balance) {
            if(err) {
                logger.error('Error in !balance command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }

            var balance = typeof(balance) == 'object' ? balance.result : balance;

            coin.getBalance(user, 0, function(err, unconfirmed_balance) {
                if(err) {
                    logger.error('Error in !balance command', err);
                    ircClient.say(channel, settings.messages.balance.expand({balance: balance, name: user}));
                    return;
                }

                var unconfirmed_balance = typeof(unconfirmed_balance) == 'object' ? unconfirmed_balance.result : unconfirmed_balance;

                ircClient.say(channel, settings.messages.balance_unconfirmed.expand({balance: balance, name: user, unconfirmed: unconfirmed_balance - balance}));
            })
        });
    }
};
