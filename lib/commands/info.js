var logger = require('winston'),
    util = require('util');

module.exports = function (coin, ircClient, settings) {
    return function info(from, channel, message) {
        coin.getInfo(function(err, info) {
            if(err) {
                logger.error('Error in !info command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }

            // if there's no multiline command, make it array anyway
            var infoMessages = util.isArray(settings.messages['info']) ? settings.messages['info'] : [settings.messages['info']];

            for(var i = 0; i < infoMessages.length; i++) {
                ircClient.say(channel, infoMessages[i].expand({
                    blocks: info.blocks,
                    pos_diff: info.difficulty,
                    connectioncount: info.connections,
                    moneysupply: info.moneysupply
                }));
            }
            return;
        });
    }
};
