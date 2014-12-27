var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function rain(from, channel, message) {
        var match = message.match(/^.?rain (random)?([\d\.]+) ?(\d+)?/);
        if(match == null || !match[2]) {
            ircClient.say(channel, 'Usage: !rain <amount> [max people]');
            return;
        }

        var random = match[1];
        var amount = Number(match[2]);
        var max    = Number(match[3]);

        if(isNaN(amount)) {
            ircClient.say(channel, settings.messages.invalid_amount.expand({name: from, amount: match[2]}));
            return;
        }

        if(random) {
            var min = settings.coin.min_rain;
            var maxAmount = amount;
            amount  = Math.floor(Math.random() * (maxAmount - min + 1)) + min;
        }

        if(isNaN(max) || max < 1) {
            max = false;
        }
        else {
            max = Math.floor(max);
        }

        coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
            if(err) {
                logger.error('Error in !tip command.', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }
            var balance = typeof(balance) == 'object' ? balance.result : balance;

            if(balance >= amount) {
                ircClient.getNames(channel, function(names) {
                    // remove tipper from the list
                    names.splice(names.indexOf(from), 1);
                    // shuffle the array
                    for(var j, x, i = names.length; i; j = Math.floor(Math.random() * i), x = names[--i], names[i] = names[j], names[j] = x);

                    max = max ? Math.min(max, names.length) : names.length;
                    if(max == 0) return;
                    var whole_channel = false;
                    if(max == names.length) whole_channel = true;
                    names = names.slice(0, max);

                    if(amount / max < settings.coin.min_rain) {
                        ircClient.say(channel, settings.messages.rain_too_small.expand({from: from, amount: amount, min_rain: settings.coin.min_rain * max}));
                        return;
                    }

                    for (var i = 0; i < names.length; i++) {
                        coin.move(from.toLowerCase(), names[i].toLowerCase(), amount / max, function(err, reply) {
                            if(err || !reply) {
                                logger.error('Error in !tip command', err);
                                return;
                            }
                        });
                    }

                    ircClient.say(channel, settings.messages.rain.expand({name: from, amount: amount / max, list: whole_channel ? 'the whole channel' : names.join(', ')}));
                });
            } else {
                logger.info('%s tried to rain %d, but has only %d', from, amount, balance);
                ircClient.say(channel, settings.messages.no_funds.expand({name: from, balance: balance, short: amount - balance, amount: amount}));
            }
        });

    }
};
