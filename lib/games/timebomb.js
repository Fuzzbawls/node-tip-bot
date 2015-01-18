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
 * TimeBomb constructor
 * @param {object} options    Game config
 * @param {object} i18n       Translations
 * @param {object} coinClient Client of cryptocurrency daemon
 */
function TimeBomb(options, i18n, coinClient) {
	this.i18n = i18n;
	this.coinClient = coinClient;
	this.potAccountName = 'timebomb_pot';
	this.rainPotAccountName = 'timebomb_rainpot';
	this.defaultConfig = {
		minWires: 3,
		maxWires: 5,
		disarmTime: 60000, // [ms]
		maxPot: 1000,
		minBet: 1,
		maxBet: 5,
		fee: 1,
		sustainPercent: 25,
		stakeMultiplicator: 2,
		showStatusInterval: 3, // [s]
		colors: [
			'Amaranth', 'Auburn', 'Burgundy', 'Cardinal', 'Carmine', 'Cerise', 'Chestnut', 'Crimson',
			'Flame', 'Folly', 'Fuchsia', 'Lava', 'Lust', 'Magenta', 'Maroon', 'Raspberry', 'Red',
			'Redwood', 'Rose', 'Rosewood', 'Ruby', 'Rusty', 'Rust', 'Scarlet', 'Vermilion', 'Wine'
		]
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
	// game round
	this.round = 1;
	// channel name
	this.channel = null;
	// flag indicating game in progress (no other player can start new game)
	this.gameInProgress = false;
	// flag indicating that bomb is armed
	this.bombArmed = false;
	// handle for stopping timer
	this.timerHandle = null;
	// timestamp when bomb explodes
	this.explodeTime = null;
	// timestamp until when bot awaits user decision
	this.decisionTime = null;
	// correct wire to cut name is stored here
	this.correctWire = null;
	// randomized wires colors array in game
	this.wiresColors = null;
	// wiresColors lowercased - to quickly check if wire exist
	this.lowerCaseWiresColors = null;
	// extend default options
	this.settings = extend({}, this.defaultConfig, options);

	events.EventEmitter.call(this);

}

TimeBomb.prototype.__proto__ = events.EventEmitter.prototype;

TimeBomb.prototype.getConfig = function(name, type) {
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

TimeBomb.prototype.getTimeLeft = function(time) {
	return (0|((time - +new Date())/1000));
}

TimeBomb.prototype.getPotBalance = function() {
	return this.potBalance;
}

TimeBomb.prototype.getRainPotBalance = function() {
	return this.rainPotBalance;
}

TimeBomb.prototype.canCutWire = function(userName) {
	return this.gameInProgress && this.bombArmed && this.player == userName;
}

TimeBomb.prototype.canDecideOnGame = function(userName) {
	return this.gameInProgress && !this.bombArmed && this.player == userName;
}

TimeBomb.prototype.canStartGame = function(bet) {
	return ((bet * this.getConfig('stakeMultiplicator', 'float')) <= this.getPotBalance());
}

TimeBomb.prototype.updatePotsBalances = function(callback) {
	var locals = {},
		timebomb = this;
	async.parallel([
        // Pot balance
        function(callback) {
			timebomb.coinClient.getBalance(timebomb.potAccountName, 3, function(err, balance) {
				if(err) {
					logger.error('Error in !balance command', err);
                	return callback(err);
				}
				var balance = typeof(balance) == 'object' ? balance.result : balance;
				timebomb.potBalance = balance;
				locals.pot = balance;
                callback();
            });
        },
        // Rain pot balance
        function(callback) {
			timebomb.coinClient.getBalance(timebomb.rainPotAccountName, 3, function(err, balance) {
				if(err) {
					logger.error('Error in !balance command', err);
                	return callback(err);
				}
				var balance = typeof(balance) == 'object' ? balance.result : balance;
				timebomb.rainPotBalance = balance;
				locals.rainPot = balance;
                callback();
            });
        }
    ], function(err) { //This function gets called after the two tasks have called their "task callbacks"
        callback(null, locals);
    });
};

TimeBomb.prototype.tick = function() {
	var timeLeft = this.getTimeLeft(this.explodeTime);
	if (timeLeft<=0) {
		this.emit('timeisup', this);
		this.boom();
	} else if (timeLeft % this.getConfig('showStatusInterval', 'int') /* show status every Xs */ == 0){
		this.emit('tick', timeLeft);
	}
}

TimeBomb.prototype.decisionTick = function() {
	var timeLeft = this.getTimeLeft(this.decisionTime);
	if (timeLeft<=0) {
		this.emit('decisiontimeisup', this);
		this.boom();
	} else if (timeLeft % this.getConfig('showDecisionReminderInterval', 'int') /* show status every Xs */ == 0){
		this.emit('decisiontick', timeLeft);
	}
}

TimeBomb.prototype.randomizeWire = function() {
	var self = this;
	// randomize wires color
	this.wiresColors = this.settings.colors.slice().sort(function() {
		return .5 - Math.random();
	}).slice(0, getRandomInt(this.getConfig('minWires', 'int'), this.getConfig('maxWires', 'int')));

	// choose correct wire
	this.correctWire = this.wiresColors[0|Math.random()*this.wiresColors.length].toLowerCase();
	logger.log('info', 'Wires in game: %s, correct wire: %s', JSON.stringify(this.wiresColors), this.correctWire);

	this.lowerCaseWiresColors = [];
	this.wiresColors.forEach(function(color) {
		self.lowerCaseWiresColors.push(color.toLowerCase());
	});
	this.bombArmed = true;
}

TimeBomb.prototype.hasWire = function(wireColor) {
	return this.lowerCaseWiresColors.indexOf(wireColor)>-1;
}

TimeBomb.prototype.startTimer = function() {
	var self = this;
	this.explodeTime = +new Date() + this.getConfig('disarmTime', 'int');
	this.timerHandle = setInterval(function() {
		self.tick();
	}, 1000);
}

TimeBomb.prototype.stopTimer = function() {
	clearInterval(this.timerHandle);
	this.explodeTime = null;
	this.timerHandle = null;
}

TimeBomb.prototype.startDecisionTimer = function() {
	var self = this;
	this.decisionTime = +new Date() + this.getConfig('decisionTime', 'int');
	this.timerHandle = setInterval(function() {
		self.decisionTick();
	}, 1000);
}

TimeBomb.prototype.stopDecisionTimer = function() {
	clearInterval(this.timerHandle);
	this.decisionTime = null;
	this.timerHandle = null;
}

/**
 * Starts game
 * @param {String} channel    Channel name
 * @param {String} playerName Player nickname on IRC
 * @param {number} bet        Bet for a game
 */
TimeBomb.prototype.startGame = function(channel, playerName, bet, callback) {
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

TimeBomb.prototype.setStartGameFlags = function(channel, playerName, bet) {
	// be sure no other game started in meanwhile
	if (this.gameInProgress) {
		throw new Error('Cannot start a new game while game in progress!');
		return;
	}
	this.gameInProgress = true;
	this.player = playerName;
	this.playerBalance = bet;
	this.playerBet = bet;
	this.round = 1;
	this.randomizeWire();
	this.startTimer();

	this.emit('gamestart', this);
}

TimeBomb.prototype.cutWire = function(color) {
	if (!this.bombArmed) {
		logger.error('Cannot cut wire if bomb is not armed!');
		return;
	}

	var correct = (color == this.correctWire);
	if (correct) {
		this.correct();
	} else {
		this.boom();
	}
	this.bombArmed = false;
	return correct;
}

TimeBomb.prototype.correct = function() {
	this.stopGame();
	this.playerBalance = this.playerBet * this.getConfig('stakeMultiplicator', 'float');
	this.emit('correct', this);
	this.checkPotBalance();
}

TimeBomb.prototype.rain = function(rainAmount) {
	this.rainPotBalance = 0;
	this.emit('rain', rainAmount);
}

TimeBomb.prototype.checkPotBalance = function() {
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

TimeBomb.prototype.moveCoinsToRainPot = function(cb) {
	var bomb = this;

	// move lost player balance to rainpot
	this.coinClient.move(this.potAccountName, this.rainPotAccountName, bomb.playerBalance, function(err, reply) {
		if(err || !reply) {
			logger.error('Error when moving funds from pot to rainpot');
			cb(true, null);
			return;
		}

		// take from pot
		bomb.potBalance -= bomb.playerBalance;
		// give to rain pot
		bomb.rainPotBalance += bomb.playerBalance;
		logger.info('Rain pot balance: ' + bomb.getRainPotBalance() + ' (' + bomb.playerBalance + ' added)');
		bomb.playerBalance = 0;
		cb(null, true);
	});
}

TimeBomb.prototype.checkRainPotOverflow = function(cb) {
	var bomb = this;
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

			bomb.coinClient.getBalance(bomb.rainPotAccountName, 0, function(err, balance) {
				if(err) {
					logger.error('Error in !balance command', err);
                	return cb(err);
				}
				var balance = typeof(balance) == 'object' ? balance.result : balance;
				bomb.rain(balance);
				cb(null, true);
			});
		});

	} else {
		cb(null, true);
	}
}

TimeBomb.prototype.depositPlayerBet = function(playerName, bet, cb) {
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

TimeBomb.prototype.boom = function() {
	var bomb = this;
	this.stopGame();
	var lostAmount = this.playerBalance;
	logger.info('Player ' + bomb.player + ' loses ' + lostAmount);
	this.moveCoinsToRainPot(function() {
		bomb.emit('boom', lostAmount);
		bomb.checkRainPotOverflow(function() {
			bomb.endGame();
		});
	});
}

TimeBomb.prototype.resumeGame = function() {
	if (this.bombArmed) {
		return;
		//throw new Error('Cannot resume game while game in progress!');
	}
	this.stopDecisionTimer();
	this.round++;
	this.playerBet = this.playerBalance;
	this.randomizeWire();
	this.startTimer();
	this.emit('gamestart', this);
}

TimeBomb.prototype.stopGame = function() {
	this.stopTimer();
}

TimeBomb.prototype.endGame = function() {
	this.stopDecisionTimer();
	this.stopGame();
	this.gameInProgress = false;
	this.player = null;
}

TimeBomb.prototype.payoutWinnings = function(cb) {
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

TimeBomb.prototype.resignGame = function(_cb) {
	var cb = _cb || function(){};
	var bomb = this;
	if (this.bombArmed) {
		cb(true, null);
		return;
		//throw new Error('Cannot resign game while game in progress!');
	}
	// payout money
	var won = this.playerBalance;
	this.payoutWinnings(function() {
		logger.info('Player ' + bomb.player + ' wins ' + won);
		bomb.endGame();
		bomb.emit('resign', won);
		cb(false, true);
	});

}

module.exports = TimeBomb;
