var DEBUG_MODE = process.env.DEBUG_MODE==1 ? true : false;
var coinClient = DEBUG_MODE ? require('../lib/fake-client') : require('node-dogecoin'),
    logger = require('winston');

module.exports = function (settings) {
    var coin = coinClient({
        host: settings.rpc.host,
        port: settings.rpc.port,
        user: settings.rpc.user,
        pass: settings.rpc.pass
    });

    if (DEBUG_MODE) {
        // gimme some fake money
        coin.incomingTx('zeewolf', 10000);
        coin.incomingTx('drew', 10000);
        coin.incomingTx('presstab', 10000);
        coin.incomingTx(settings.timebomb.potAccountName, 500);
        coin.incomingTx(settings.dice.potAccountName, 500);
    }

    coin.getBalance(function(err, balance) {
        if(err) {
            logger.error('Could not connect to %s RPC API! ', settings.coin.full_name, err);
            process.exit(1);
            return;
        }

        var balance = typeof(balance) == 'object' ? balance.result : balance;
        logger.info('Connected to %s RPC API. Current total balance is %d %s', settings.coin.full_name, balance, settings.coin.short_name);
    });

    return coin;
};
