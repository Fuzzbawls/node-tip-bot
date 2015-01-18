var events = require('events'),
	logger = require('winston');

function extend(target) {
	var sources = [].slice.call(arguments, 1);
	sources.forEach(function (source) {
		for (var prop in source) {
			target[prop] = source[prop];
		}
	});
	return target;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Dice constructor
 * @param {object} options    Game config
 * @param {object} i18n       Translations
 * @param {object} coinClient Client of cryptocurrency daemon
 */
function Dice(options, i18n, coinClient) {
	this.i18n = i18n;
	this.coinClient = coinClient;
	this.potAccountName = 'dice_pot';
	this.defaultConfig = {
		minBet: 1,
		maxBet: 5,
		fee: 1
	};
	// game settings
	this.settings = {};
	// current player name
	this.player = null;
	// player bet for current game
	this.playerBet = 0;
	// player balance
	this.playerBalance = 0;
	// rain pot balance
	this.diceBalance = 0;
	// channel name
	this.channel = null;
	// flag indicating game in progress (no other player can start new game)
	this.gameInProgress = false;
	// extend default options
	this.settings = extend({}, this.defaultConfig, options);

	events.EventEmitter.call(this);
}

Dice.prototype.__proto__ = events.EventEmitter.prototype;

Dice.prototype.getConfig = function(name, type) {
	var value = this.settings[name];
	switch(type) {
		case 'int':
			value = parseInt(value, 10);
		break;
		case 'float':
			value = parseFloat(value);
		break;
		case 'bool':
			value = !!value;
		break;
		default:
	}
	return value;
}

Dice.prototype.getPotBalance = function() {
	return this.potBalance;
}

Dice.prototype.updatePotsBalances = function(callback) {
	var locals = {},
		timebomb = this;

    // Pot balance
	timebomb.coinClient.getBalance(timebomb.potAccountName, 3, function(err, balance) {
		if(err) {
			logger.error('Error in !balance command', err);
        	return callback(err);
		}
		var balance = typeof(balance) == 'object' ? balance.result : balance;
		timebomb.potBalance = balance;
        callback(null, locals);
    });
};

Dice.prototype.rollDice = function() {
	var self = this;
	// randomize wires color
	this.rolled = [ getRandomInt(1,6), getRandomInt(1,6) ].sort();
	logger.log('info', 'Rolled %s and %s', this.rolled[0], rolled[1]);
}

/**
 * Starts game
 * @param {String} channel    Channel name
 * @param {String} playerName Player nickname on IRC
 * @param {number} bet        Bet for a game
 */
Dice.prototype.startGame = function(channel, playerName, bet, callback) {
	var timebomb = this;
	this.channel = channel;

	if (this.gameInProgress) {
		throw new Error('Cannot start a new game while game in progress!');
	}

	if (bet<this.getConfig('minBet', 'float') || bet>this.getConfig('maxBet', 'float')) {
		this.emit('wrongbet', this, channel);
		if (callback) {
			callback(true, null);
		}
		return;
	}

	// check player's balance
	this.coinClient.getBalance(playerName.toLowerCase(), 3, function(err, balance) {
		if(err) {
			logger.error('Error in !balance command', err);
			if (callback) {
				callback(true, null);
			}
			return;
		}

		var balance = typeof(balance) == 'object' ? balance.result : balance;

		if (bet > balance) {
			logger.error('Bet is greater than players balance');
			timebomb.emit('nofunds', this);
		} else {
			timebomb.depositPlayerBet(playerName.toLowerCase(), bet, function(err, reply) {
				if(err || !reply) {
					if (callback) {
						callback(true, null);
					}
					return;
				}

				timebomb.setStartGameFlags(channel, playerName, bet);

				if (callback) {
					callback(null, true);
				}
			});
		}
	});
}

Dice.prototype.setStartGameFlags = function(channel, playerName, bet) {
	// be sure no other game started in meanwhile
	if (this.gameInProgress) {
		throw new Error('Cannot start a new game while game in progress!');
		return;
	}
	this.gameInProgress = true;
	this.player = playerName;
	this.playerBalance = bet;
	this.playerBet = bet;
	this.rollDice();

	this.emit('gamestart', this);
}

Dice.prototype.checkPotBalance = function() {
	var bomb = this;
	if (!this.canStartGame(this.playerBalance)) {
		this.emit('nofundsinpot', this.getPotBalance());
		var won = this.playerBalance;
		this.payoutWinnings(function() {
			logger.info('Player ' + bomb.player + ' wins ' + won);
			bomb.endGame();
			bomb.emit('resign', won);
		});

	} else {
		this.startDecisionTimer();
	}
}

Dice.prototype.depositPlayerBet = function(playerName, bet, cb) {
	var bomb = this;

	this.coinClient.move(playerName, this.potAccountName, bet, function(err, reply) {
		if(err || !reply) {
			logger.error('Error during depositing coins to potAccount.');
			cb(true, null);
			return;
		}
		bomb.potBalance += bet;
		cb(null, true);
	});

}

Dice.prototype.payoutWinnings = function(cb) {
	var bomb = this;
	this.coinClient.move(this.potAccountName, this.player.toLowerCase(), this.playerBalance-this.settings.fee, function(err, reply) {
		if(err || !reply) {
			cb(true, null);
			return;
		}
		bomb.playerBalance = 0;
		cb(null, true);
	});
}


module.exports = Dice;
