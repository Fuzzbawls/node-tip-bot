var logger = require('winston');

module.exports = function (coin, ircClient, settings) {

    var listAccounts = {
        run: function (from, channel, message) {
            var accounts = coin.listAccounts();
            var resp = JSON.stringify(accounts);
            ircClient.say(channel, resp);
        },
        commands: ['listaccounts']
    };

    return listAccounts;
};
