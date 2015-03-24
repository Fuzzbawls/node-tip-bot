module.exports = function (coin, ircClient, settings) {
    var commands = {};
    // Load `*.js` under commands directory as properties
    //  i.e., `User.js` will become `exports['User']` or `exports.User`
    require('fs').readdirSync(__dirname + '/commands/').forEach(function(file) {
        if (file.match(/.+\.js/g) !== null && file !== 'index.js' && file.match(/^_.+/) === null) {
            var name = file.replace('.js', '');
            var commandLib = require('./commands/' + file)(coin, ircClient, settings);
            if (!commandLib.commands) {
                commands[name] = commandLib;
            } else {
                commandLib.commands.forEach(function(command) {
                    commands[command] = commandLib.run;
                });
            }
        }
    });
    return commands;
};
