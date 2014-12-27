var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function withdraw(from, channel, message) {
        var match = message.match(/^.?withdraw (\S+)$/);
        if(match == null) {
            ircClient.say(channel, 'Usage: !withdraw <' + settings.coin.full_name + ' address>');
            return;
        }
        var address = match[1];

        coin.validateAddress(address, function(err, reply) {
            if(err) {
                logger.error('Error in !withdraw command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }

            if(reply.isvalid) {
                coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
                    if(err) {
                        logger.error('Error in !withdraw command', err);
                        ircClient.say(channel, settings.messages.error.expand({name: from}));
                        return;
                    }
                    var balance = typeof(balance) == 'object' ? balance.result : balance;

                    if(balance < settings.coin.min_withdraw) {
                        logger.warn('%s tried to withdraw %d, but min is set to %d', from, balance, settings.coin.min_withdraw);
                        ircClient.say(channel, settings.messages.withdraw_too_small.expand({name: from, balance: balance}));
                        return;
                    }

                    coin.sendFrom(from.toLowerCase(), address, balance - settings.coin.withdrawal_fee, function(err, reply) {
                        if(err) {
                            logger.error('Error in !withdraw command', err);
                            ircClient.say(channel, settings.messages.error.expand({name: from}));
                            return;
                        }

                        var values = {name: from, address: address, balance: balance, amount: balance - settings.coin.withdrawal_fee, transaction: reply}
                        for(var i = 0; i < settings.messages.withdraw_success.length; i++) {
                            var msg = settings.messages.withdraw_success[i];
                            ircClient.say(channel, msg.expand(values));
                        };

                        // transfer the rest (usually withdrawal fee - txfee) to bots wallet
                        coin.getBalance(from.toLowerCase(), function(err, balance) {
                            if(err) {
                                logger.error('Something went wrong while transferring fees', err);
                                return;
                            }

                            var balance = typeof(balance) == 'object' ? balance.result : balance;

                            // moves the rest to bot's wallet
                            coin.move(from.toLowerCase(), settings.login.nickname.toLowerCase(), balance);
                        });
                    });
                });
            } else {
                logger.warn('%s tried to withdraw to an invalid address', from);
                ircClient.say(channel, settings.messages.invalid_address.expand({address: address, name: from}));
            }
        });

    }
};
