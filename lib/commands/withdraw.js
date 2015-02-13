var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function withdraw(from, channel, message) {
        var match = message.match(/^.?withdraw (\S+)\s?(\S+)$/);
        if(match == null) {
            ircClient.say(channel, 'Usage: !withdraw <' + settings.coin.full_name + ' address> [amount]');
            return;
        }
        var address = match[1];
        var amount = parseFloat(match[2]);

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

                    // no amount given, withdraw all balance

                    if (isNaN(amount) || (!isNaN(amount)&&(amount+settings.coin.withdrawal_fee >= balance))) {

                        if(balance < settings.coin.min_withdraw) {
                            logger.warn('%s tried to withdraw %d, but min is set to %d', from, balance, settings.coin.min_withdraw);
                            ircClient.say(channel, settings.messages.withdraw_too_small.expand({name: from, balance: balance}));
                            return;
                        }

                        // send balance-fee to withdrawal address
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
                            coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
                                if(err) {
                                    logger.error('Something went wrong while transferring fees', err);
                                    return;
                                }

                                var balance = typeof(balance) == 'object' ? balance.result : balance;

                                // moves the rest to bot's wallet
                                coin.move(from.toLowerCase(), settings.login.nickname.toLowerCase(), balance);
                            });
                        });

                    } else {
                        // withdraw only chosen amount
                        logger.info('Withdrawing part');
                        // check if amount is lower/equal to amount
                        if(amount > balance) {
                            logger.warn('%s tried to withdraw %d, but min is set to %d', from, amount, balance);
                            ircClient.say(channel, settings.messages.withdraw_too_small.expand({name: from, balance: balance}));
                            return;
                        }

                        if(amount < settings.coin.min_withdraw) {
                            logger.warn('%s tried to withdraw %d, but min is set to %d', from, balance, settings.coin.min_withdraw);
                            ircClient.say(channel, settings.messages.withdraw_too_small.expand({name: from, balance: balance}));
                            return;
                        }

                        logger.info('%s withdrawing %d of %d %s', from.toLowerCase(), amount, balance, settings.coin.short_name);

                        // send amount-fee to withdrawal address, rest back to user's address

                        // get user address
                        coin.send('getaccountaddress', from.toLowerCase(), function(err, userAddress) {
                            if(err) {
                                logger.error('Something went wrong while getting address. ' + err);
                                ircClient.say(channel, settings.messages.error.expand({name: from}));
                                return false;
                            }


                            // sendmany <fromaccount> {address:amount,...} [minconf=1] [comment]
                            var manyAddresses = {};
                            manyAddresses[address] = amount;
                            manyAddresses[userAddress] = balance - amount - settings.coin.withdrawal_fee;

                            coin.sendMany(from.toLowerCase(), manyAddresses, function(err, reply) {
                                if (err) {
                                    logger.error('Error in !withdraw command', err);
                                    ircClient.say(channel, settings.messages.error.expand({name: from}));
                                    return;
                                }

                                var values = {name: from, address: address, amount: amount, amount_left: balance - amount - settings.coin.withdrawal_fee, transaction: reply}
                                for(var i = 0; i < settings.messages.partial_withdraw_success.length; i++) {
                                    var msg = settings.messages.partial_withdraw_success[i];
                                    ircClient.say(channel, msg.expand(values));
                                };

                                // transfer the withdrawal fee (txfee) to bots wallet
                                coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
                                    if (err) {
                                        logger.error('Something went wrong while transferring fees', err);
                                        return;
                                    }

                                    var balance = typeof(balance) == 'object' ? balance.result : balance;

                                    // moves the rest to bot's wallet
                                    coin.move(from.toLowerCase(), settings.login.nickname.toLowerCase(), settings.coin.withdrawal_fee);
                                });
                            });
                        });
                    }


                });
            } else {
                logger.warn('%s tried to withdraw to an invalid address', from);
                ircClient.say(channel, settings.messages.invalid_address.expand({address: address, name: from}));
            }
        });

    }
};
