var logger = require('winston');

module.exports = function (coin, ircClient, settings) {
    return function info(from, channel, message) {
        coin.getMiningInfo(function(err, mininginfo) {
            if(err) {
                logger.error('Error in !info command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }

            coin.getInfo(function(err, info) {
                if(err) {
                    logger.error('Error in !info command', err);
                    ircClient.say(channel, settings.messages.error.expand({name: from}));
                    return;
                }

                for(var i = 0; i < settings.messages[command].length; i++) {
                    ircClient.say(channel, settings.messages.info.expand({
                        blocks: mininginfo.blocks,
                        //   pow_diff: mininginfo['PoW difficulty'],
                        pos_diff: mininginfo['PoS difficulty'],
                        moneysupply: info.moneysupply,
                        netmhashps: mininginfo.networkhashps/1000000
                    }));
                }
                return;
            });
        });
    }
};
