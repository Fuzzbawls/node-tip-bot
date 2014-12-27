var settings = require('./lib/settings'),
    ircClient = require('./lib/irc')(settings),
    logger = require('./lib/logger')(settings),
    coin = require('./lib/coin-client')(settings),
    webadmin = require('./lib/webadmin/app'),
    commands = require('./lib/commands')(coin, ircClient, settings);

// handle sigint
process.on('exit', function() {
  logger.info('Exiting...');
  if(ircClient != null) {
    ircClient.disconnect('My master ordered me to leave.');
  }
});

// simple templates
String.prototype.expand = function(values) {
  var global = {
    nick: ircClient.nick
  }
  return this.replace(/%([a-zA-Z_]+)%/g, function(str, variable) {
    return typeof(values[variable]) == 'undefined' ?
      (typeof(settings.coin[variable]) == 'undefined' ?
        (typeof(global[variable]) == 'undefined' ?
          str : global[variable]) : settings.coin[variable]) : values[variable];
  });
}

ircClient.addListener('message', function(from, channel, message) {
  var match = message.match(/^(!?)(\S+)/);
  if(match == null) return;
  var prefix  = match[1];
  var command = match[2];

  if(settings.commands[command]) {
    // PM
    if(channel == ircClient.nick && settings.commands[command].pm === false) return;
    // channel message
    if(channel != ircClient.nick && (settings.commands[command].channel === false || prefix != '!')) return;
  } else {
    return;
  }

  // if pms, make sure to respond to pms instead to itself
  if(channel == ircClient.nick) channel = from;

  // comands that don't require identifying
  if(command == 'help' || command == 'terms') {
      commands['help'](from, channel, message);
      return;
  }

  // if not that, message will be undefined for some reason
  // todo: find a fix for that
  var msg = message;
  ircClient.isIdentified(from, function(status) {
    var message = msg;
    // check if the sending user is logged in (identified) with nickserv
    if(!status) {
      logger.info('%s tried to use command `%s`, but is not identified.', from, message);
      ircClient.say(channel, settings.messages.not_identified.expand({name: from}));
      return;
    }

    // Handle commands
    var fn = commands[command];
    if (fn) {
        (fn.run || fn)(from, channel, message);
    }

  });
});

// run webadmin
if (settings.webadmin.enabled) {
  logger.info('Running webadmin on port %d', settings.webadmin.port);
  webadmin.app(settings.webadmin.port, coin, settings, logger);
}

// export commands to use them in other modules
exports.commands = commands;
