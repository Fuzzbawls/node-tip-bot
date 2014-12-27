var fs = require('fs'),
    yaml = require('js-yaml');

// check if the config file exists
if(!fs.existsSync('./config/config.yml')) {
    console.error('Configuration file doesn\'t exist! Please read the README.md file first.');
    process.exit(1);
}

// load settings
var settings = yaml.load(fs.readFileSync('./config/config.yml', 'utf-8'));

module.exports = settings;
