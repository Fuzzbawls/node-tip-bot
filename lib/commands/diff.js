var logger = require('winston'),
    db = require('../json-store'),

    diffStoreKey = 'diff';
    diffData = {
        low: null,
        high: null
    };

// load diff json store if available on start
db.load(diffStoreKey, function(err, data) {
    if (!err) {
        diffData = data;
    }
});

function storeDiff(diff) {
    diffData.low = diffData.low === null ? diff : Math.min(diffData.low, diff);
    diffData.high = diffData.high === null ? diff : Math.max(diffData.high, diff);
    db.save(diffStoreKey, diffData, function() {});
}

module.exports = function (coin, ircClient, settings) {
    return function diff(from, channel, message) {
        coin.getMiningInfo(function(err, mininginfo) {
            if(err) {
                logger.error('Error in !diff command', err);
                ircClient.say(channel, settings.messages.error.expand({name: from}));
                return;
            }


            var diff = mininginfo['PoS difficulty'];
            storeDiff(diff);

            ircClient.say(channel, settings.messages.diff.expand({
                diff: diff != null ? diff.toFixed(8) : '---',
                atl:  diffData.low != null ? diffData.low.toFixed(8) : '---',
                ath:  diffData.high != null ? diffData.high.toFixed(8) : '---'
            }));
        });
    }
};
