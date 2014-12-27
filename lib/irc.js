var irc = require('irc'),
    logger = require('winston');

module.exports = function (settings) {

    // gets user's login status
    irc.Client.prototype.isIdentified = function(nickname, callback) {
      // request login status
      this.say('NickServ', 'ACC ' + nickname);
      // wait for response
      var listener = function(from, to, message) {
       // // proceed only on NickServ's ACC response
        var regexp = new RegExp('^(\\S+) ACC (\\d)');
        if(from != undefined && from.toLowerCase() == 'nickserv' && regexp.test(message)) {
          var match = message.match(regexp);
          var user  = match[1];
          var level = match[2];

          // if the right response, call the callback and remove this listener
          if(user.toLowerCase() == nickname.toLowerCase()) {
            callback(level == 3);
            this.removeListener('notice', listener);
          }
        }
      }

      this.addListener('notice', listener);
    }

    irc.Client.prototype.getNames = function(channel, callback) {
      ircClient.send('NAMES', channel);
      var listener = function(nicks) {
        var names = [];
        for(name in nicks) {
          names.push(name);
        }
        callback(names);
        this.removeListener('names' + channel, listener);
      }

      this.addListener('names' + channel, listener);
    }

    var ircClient = new irc.Client(settings.connection.host, settings.login.nickname, {
        port: settings.connection.port,
        secure: settings.connection.secure,
        channels: settings.channels,
        userName: settings.login.username,
        realName: settings.login.realname,
        debug: settings.connection.debug
    });

    // basic handlers
    ircClient.addListener('registered', function(message) {
      logger.info('Connected to %s.', message.server);

      ircClient.say('NickServ', 'IDENTIFY ' + settings.login.nickserv_password);
    });

    ircClient.addListener('error', function(message) {
      logger.error('Received an error from IRC network: ', message);
    });

    return ircClient;
};
