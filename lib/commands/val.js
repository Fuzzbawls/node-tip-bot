var logger = require('winston'),
    https = require('https');

var cache = {
    ttl: 1000 * 60 * 10, // 10 minutes
    store: {},
    set: function(key, data) {
        this.store[key] = {
            expiration: +new Date() + this.ttl,
            data: data
        };
    },
    get: function(key) {
        if (this.store[key] && this.store[key].expiration>(+new Date())) {
            //logger.info('Cache hit: %s', key);
            return this.store[key].data;
        } else {
            //logger.info('Cache miss: %s', key);
            return false;
        }
    }
};

module.exports = function (coin, ircClient, settings) {
    return function val(from, channel, message) {

        function showInfo(data, amount) {
            var ticker = data.ticker,
                base = ticker.base,
                target = ticker.target,
                price = ticker.price,
                value = (parseFloat(ticker.price) * amount).toFixed(8),
                volume = ticker.volume;

            ircClient.say(channel, settings.messages.val.exchanged.expand({value: value, amount: amount, base: base, price: price, target: target}));
        }
        var user = from.toLowerCase();
        var command = message.match(/^.?val (\S+) (\S+)(?:\s(\S+))?/);

        // if wrong use - say how to use properly
        if (!command) {
            ircClient.say(channel, settings.messages.val.usage.expand({}));
            return;
        }

        var currency_from,
            currency_to,
            amount;

        // no amount given
        if (typeof command[3] === 'undefined') {
            currency_from = command[1].toLowerCase(),
            currency_to = command[2].toLowerCase(),
            amount = 1;
        } else {
            currency_from = command[2].toLowerCase(),
            currency_to = command[3].toLowerCase(),
            amount = parseFloat(command[1]);
        }

        var cache_key = currency_from+'_'+currency_to;

        // try to fetch from cache
        var data = cache.get(cache_key);
        // if something is cached - use it
        if (data) {
            showInfo(data, amount);
            return;
        }

        // if not - make a request

        // prepare cryptonator API request options
        var options = {
            hostname: 'www.cryptonator.com',
            port: '443',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': 'Mozilla/5.0'
            },
            path: "/api/ticker/"+currency_from+"-"+currency_to
        };

        // handle request
        var req = https.request(options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (data) {
                jsondata = JSON.parse(data);
                if (jsondata.success) {
                    cache.set(cache_key, jsondata);
                    showInfo(jsondata, amount);
                } else {
                    ircClient.say(channel, settings.messages.val.error);
                }
            });
        });
        req.on('error', function(e) {
            logger.error('problem with request: ' + e.message);
        });
        req.end();
    }
};
