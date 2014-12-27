var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function rainactive(from, channel, message) {
        if (!settings.commands.rainactive.enabled)
        {
            ircClient.say(channel, 'Unknown Command');
            return;
        }
        var match = message.match(/^.?rainactive (random)?([\d\.]+) ?(\d+)?/);
        if(match == null || !match[3]) {
          ircClient.say(channel, 'Usage: !rainactive <amount> [active X minutes ago]');
          return;
        }

        var random = match[1];
        var amount = Number(match[2]);
        var activetime = Number(match[3]);

        if(isNaN(amount)) {
          ircClient.say(channel, settings.messages.invalid_amount.expand({name: from, amount: match[2]}));
          return;
        }

        if(random) {
          var min = settings.coin.min_rain;
          var maxAmount = amount;
          amount = Math.floor(Math.random() * (maxAmount - min + 1)) + min;
        }

        /*if(isNaN(max) || max < 1) {
          max = false;
        } else {
          max = Math.floor(max);
        }*/

        coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
          if (err) {
            winston.error('Error in !tip command.', err);
            ircClient.say(channel, settings.messages.error.expand({name: from}));
            return;
          }
          var balance = typeof(balance) == 'object' ? balance.result : balance;

         if (balance >= amount) {
            ircClient.getNames(channel, function(names) {
              // rain only on nicknames active within the last x seconds - presstab edition !rainactive - config.yml rainactive, enable =1
              if (settings.commands.rainactive.enabled) {
                for (var i = names.length - 1; i >= 0; i--) {
                  if (!last_active.hasOwnProperty(names[i]) || last_active[names[i]] + activetime * 60 * 1000 < Date.now()) {
                    names.splice(i, 1);
                  }
                };
              }
              // remove tipper from the list
              names.splice(names.indexOf(from), 1);
              // shuffle the array
              for(var j, x, i = names.length; i; j = Math.floor(Math.random() * i), x = names[--i], names[i] = names[j], names[j] = x);

              /*max = max ? Math.min(max, names.length) : names.length;
              if(max == 0) return;
              var whole_channel = false;
              if(max == names.length) whole_channel = true;
              names = names.slice(0, max);*/

              if (amount / names.length < settings.coin.min_rain) {
                ircClient.say(channel, settings.messages.rain_too_small.expand({from: from, amount: amount, min_rain: settings.coin.min_rain * names.length}));
                return;
              }

              for (var i = 0; i < names.length; i++) {
                coin.move(from.toLowerCase(), names[i].toLowerCase(), amount / names.length, function(err, reply) {
                  if(err || !reply) {
                    winston.error('Error in !tip command', err);
                    return;
                  }
                });
              }

              ircClient.say(channel, settings.messages.rain.expand({name: from, amount: amount / names.length, list: names.join(', ')}));
            });
          } else {
            winston.info('%s tried to tip %s %d, but has only %d', from, to, amount, balance);
            ircClient.say(channel, settings.messages.no_funds.expand({name: from, balance: balance, short: amount - balance, amount: amount}));
          }
        })

    }
};
