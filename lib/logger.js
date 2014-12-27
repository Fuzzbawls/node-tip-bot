var logger = require('winston');

module.exports = function (settings) {
    // load logger's cli defaults
    logger.cli();
    if(settings.log.file) {
        // write logs to file
        logger.add(logger.transports.File, {filename: settings.log.file, level: 'info'});
    }
    return logger;
}
