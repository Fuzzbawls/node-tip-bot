var events = require('events'),
	logger = require('winston'),
	async = require('async');

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
	this.i18n = i18n || {};
	this.coinClient = coinClient;
	this.potAccountName = 'dice_pot';
	this.rainPotAccountName = 'dice_rainpot';
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
	this.potBalance = 0;
	// rain pot balance
	this.rainPotBalance = 0;
	// channel name
	this.channel = null;
	// flag indicating game in progress (no other player can start new game)
	this.gameInProgress = false;
	// extend default options
	this.settings = extend({}, this.defaultConfig, options || {});

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

Dice.prototype.getRainPotBalance = function() {
	return this.rainPotBalance;
}

Dice.prototype.updatePotsBalances = function(callback) {
	var locals = {},
		dice = this;

	async.parallel([
        // Pot balance
        function(callback) {
			dice.coinClient.getBalance(dice.potAccountName, 3, function(err, balance) {
				if(err) {
					logger.error('Error in !balance command', err);
                	return callback(err);
				}
				var balance = typeof(balance) == 'object' ? balance.result : balance;
				dice.potBalance = balance;
				locals.pot = balance;
                callback();
            });
        },
        // Rain pot balance
        function(callback) {
			dice.coinClient.getBalance(dice.rainPotAccountName, 3, function(err, balance) {
				if(err) {
					logger.error('Error in !balance command', err);
                	return callback(err);
				}
				var balance = typeof(balance) == 'object' ? balance.result : balance;
				dice.rainPotBalance = balance;
				locals.rainPot = balance;
                callback();
            });
        }
    ], function(err) { //This function gets called after the two tasks have called their "task callbacks"
        callback(null, locals);
    });
};

Dice.prototype.rollDices = function() {
	// roll it babe !
	this.rolled = [ getRandomInt(1,6), getRandomInt(1,6) ].sort();
	this.reward = this.getReward(this.rolled[0], this.rolled[1]);
	logger.log('info', 'Rolled %s and %s, reward multiplier: *%d', this.rolled[0], this.rolled[1], this.reward);
}

/**
 * Starts game
 * @param {String} channel    Channel name
 * @param {String} playerName Player nickname on IRC
 * @param {number} bet        Bet for a game
 */
Dice.prototype.play = function(channel, playerName, bet, callback) {
	var dice = this;
	this.channel = channel;

	if (this.gameInProgress) {
		//throw new Error('Cannot start a new game while game in progress!');
		return;
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
			dice.emit('nofunds', this);
		} else {
			dice.depositPlayerBet(playerName.toLowerCase(), bet, function(err, reply) {
				if(err || !reply) {
					if (callback) {
						callback(true, null);
					}
					return;
				}

				dice.setStartGameFlags(channel, playerName, bet);

				dice.rollDices();

				dice.checkResults();

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
	this.reward = null;
	this.emit('gamestart', this);
}

Dice.prototype.canStartGame = function(bet) {
	// check if we will be able to payout max. winnings (snake-eyes = double)
	return ((bet * 2) <= this.getPotBalance());
}

Dice.prototype.checkResults = function() {
	if (this.reward) {
		this.won();
	} else {
		this.lost();
	}
}

Dice.prototype.won = function(_cb) {
	var cb = _cb || function(){};
	var dice = this;

	// payout money
	var won = this.reward;
	this.payoutWinnings(function() {
		logger.info('Player ' + dice.player + ' wins ' + won);
		dice.emit('won', this);
		dice.endGame();
		cb(false, true);
	});
}

Dice.prototype.lost = function() {
	var dice = this;
	var lostAmount = this.playerBalance;
	logger.info('Player ' + dice.player + ' loses ' + lostAmount);
	this.moveCoinsToRainPot(function() {
		dice.emit('lost', lostAmount);
		dice.checkRainPotOverflow(function() {
			dice.endGame();
		});
	});
}

Dice.prototype.endGame = function() {
	this.gameInProgress = false;
	this.player = null;
}

Dice.prototype.depositPlayerBet = function(playerName, bet, cb) {
	var dice = this;

	this.coinClient.move(playerName, this.potAccountName, bet, function(err, reply) {
		if(err || !reply) {
			logger.error('Error during depositing coins to potAccount.');
			cb(true, null);
			return;
		}
		dice.potBalance += bet;
		cb(null, true);
	});

}

Dice.prototype.payoutWinnings = function(cb) {
	var dice = this;
	this.coinClient.move(this.potAccountName, this.player.toLowerCase(), this.playerBalance-this.settings.fee, function(err, reply) {
		if(err || !reply) {
			cb(true, null);
			return;
		}
		dice.playerBalance = 0;
		cb(null, true);
	});
}

Dice.prototype.moveCoinsToRainPot = function(cb) {
	var dice = this;

	// move lost player balance to rainpot
	this.coinClient.move(this.potAccountName, this.rainPotAccountName, dice.playerBalance, function(err, reply) {
		if(err || !reply) {
			logger.error('Error when moving funds from pot to rainpot');
			cb(true, null);
			return;
		}

		// take from pot
		dice.potBalance -= dice.playerBalance;
		// give to rain pot
		dice.rainPotBalance += dice.playerBalance;
		logger.info('Rain pot balance: ' + dice.getRainPotBalance() + ' (' + dice.playerBalance + ' added)');
		dice.playerBalance = 0;
		cb(null, true);
	});
}

Dice.prototype.checkRainPotOverflow = function(cb) {
	var dice = this;
	// if pot overflows - rain it !!!
	if (this.getRainPotBalance() >= this.getConfig('maxPot', 'float')) {
		var saveAmount = this.getRainPotBalance()*(this.getConfig('sustainPercent', 'float')/100);
		var rainAmount = this.getRainPotBalance()-saveAmount;
		logger.info('Rain pot balance: ' + this.rainPotBalance + ', rain: ' + rainAmount + ', save: ' + saveAmount);

		// move savings back to pot, rain rest
		this.coinClient.move(this.rainPotAccountName, this.potAccountName, saveAmount, function(err, reply) {
			if(err || !reply) {
				cb(true, null);
				logger.error('Error when moving funds from rainPot to pot');
				return;
			}

			dice.coinClient.getBalance(dice.rainPotAccountName, 0, function(err, balance) {
				if(err) {
					logger.error('Error in !balance command', err);
                	return cb(err);
				}
				var balance = typeof(balance) == 'object' ? balance.result : balance;
				dice.rain(balance);
				cb(null, true);
			});
		});

	} else {
		cb(null, true);
	}
}

Dice.prototype.rain = function(rainAmount) {
	this.rainPotBalance = 0;
	this.emit('rain', rainAmount);
}

Dice.prototype.getReward = function(dice1, dice2) {
	// snake-eyes
	if (dice1 === 1 && dice2 === 1) {
		return 2;
	}
	// doubles - 1-1, 2-2, 3-3, 4-4, 5-5, 6-6
	else if (dice1 === dice2) {
		return 0.5;
	}
	// other combinations loses
	return 0;
}

module.exports = Dice;
