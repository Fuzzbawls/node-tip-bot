var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function tip(from, channel, message) {
        var match = message.match(/^.?tip (\S+) (random)?([\d\.]+)/);
        if(match == null || match.length < 3) {
            ircClient.say(channel, 'Usage: !tip <nickname> <amount>')
            return;
        }
        var to     = match[1];
        var random = match[2];
        var amount = Number(match[3]);

        if(isNaN(amount)) {
            ircClient.say(channel, settings.messages.invalid_amount.expand({name: from, amount: match[3]}));
            return;
        }

        if(random) {
            var min = settings.coin.min_tip;
            var max = amount;
            amount  = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        if(to.toLowerCase() == from.toLowerCase()) {
            ircClient.say(channel, settings.messages.tip_self.expand({name: from}));
            return;
        }

        if(amount < settings.coin.min_tip) {
            ircClient.say(channel, settings.messages.tip_too_small.expand({from: from, to: to, amount: amount}));
            return;
        }
        // check balance with min. 5 confirmations
        coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
            if(err) {
                logger.error('Error in !tip command.', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }
            var balance = typeof(balance) == 'object' ? balance.result : balance;

            if(balance >= amount) {
                coin.send('move', from.toLowerCase(), to.toLowerCase(), amount, function(err, reply) {
                    if(err || !reply) {
                        logger.error('Error in !tip command', err);
                        ircClient.say(channel, settings.messages.error.expand({name: from}));
                        return;
                    }

                    logger.info('%s tipped %s %d%s', from, to, amount, settings.coin.short_name)
                    ircClient.say(channel, settings.messages.tipped.expand({from: from, to: to, amount: amount}));
                });
            } else {
                logger.info('%s tried to tip %s %d, but has only %d', from, to, amount, balance);
                ircClient.say(channel, settings.messages.no_funds.expand({name: from, balance: balance, short: amount - balance, amount: amount}));
            }
        });
    }
};
