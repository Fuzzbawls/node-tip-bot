var logger = require('winston'),
	TimeBomb = require('../timebomb'),
	DEBUG_MODE = process.env.DEBUG_MODE==1 ? true : false;

module.exports = function (coin, ircClient, settings) {

	/* TimeBomb events */
	var timebomb = new TimeBomb(settings.timebomb, settings.messages.timebomb, coin);

	// set up events actions
	timebomb.on('tick', function(timeLeft) {
		ircClient.say(this.channel, this.i18n.timeleft.expand({timeLeft: timeLeft}));
	})
	.on('timeisup', function() {
		ircClient.say(this.channel, this.i18n.timeisup);
	})
	.on('decisiontick', function(timeLeft) {
		ircClient.say(this.channel, this.i18n.decisiontimeleft.expand({time_left: timeLeft}));
	})
	.on('decisiontimeisup', function() {
		ircClient.say(this.channel, this.i18n.decisiontimeisup);
	})
	.on('rain', function(amountToRain) {
		var commands = require('../../tipbot').commands;
		ircClient.say(this.channel, this.i18n.potoverflow);
		logger.info(this.settings.rainPotAccountName + ' will now rain ' + amountToRain + ' to ' + this.channel);
		commands.rain(this.settings.rainPotAccountName, this.channel, '!rain ' + amountToRain);
	})
	.on('correct', function() {
		ircClient.say(this.channel, this.i18n.correct.expand({reward: this.playerBet * (this.settings.stakeMultiplicator-1), balance: this.playerBalance, fee: this.settings.fee}));
	})
	.on('boom', function(lostAmount) {
		ircClient.say(this.channel, this.i18n.boom.expand({player: this.player, lost_amount: lostAmount, pot_balance: this.getPotBalance(), rain_pot_balance: this.getRainPotBalance(), max_rain_fund: this.settings.maxPot}));
	})
	.on('log', function(msg) {
		logger.info(msg);
	})
	.on('maxstake', function(balance, maxStake) {
		ircClient.say(this.channel, this.i18n.maxstake.expand({ balance: balance, max_stake: maxStake }));
	})
	.on('resign', function(won) {
		ircClient.say(this.channel, this.i18n.resign.expand({ won: won }));
	})
	.on('wrongbet', function() {
		logger.info(this.i18n.wrongbet.expand({ min_bet: this.settings.minBet, max_bet: this.settings.maxBet }));
		ircClient.say(this.channel, this.i18n.wrongbet.expand({ min_bet: this.settings.minBet, max_bet: this.settings.maxBet }));
	})
	.on('nofunds', function() {
		logger.info(this.i18n.nofunds.expand({ min_bet: this.settings.minBet, max_bet: this.settings.maxBet }));
		ircClient.say(this.channel, this.i18n.nofunds.expand({ min_bet: this.settings.minBet, max_bet: this.settings.maxBet }));
	})
	.on('nofundsinpot', function(potBalance) {
		logger.info(this.i18n.nofundsinpot.expand({ pot_balance: potBalance }));
		ircClient.say(this.channel, this.i18n.nofundsinpot.expand({ pot_balance: potBalance }));
	})
	.on('gamestart', function() {
		ircClient.say(this.channel, this.i18n.bombactivation.expand({round: this.round, wiresCount: this.wiresColors.length, wiresColors: this.wiresColors.join(', ')}));
		if (DEBUG_MODE) {
			ircClient.say(this.channel,'[debug] Correct wire: ' + this.correctWire);
		}
	});
	/* /TimeBomb events */

	// update pot balance
	coin.getBalance(timebomb.potAccountName, settings.coin.min_confirmations, function(err, balance) {
		if(err) {
			logger.error('Could not connect to %s RPC API! ', settings.coin.full_name, err);
			//process.exit(1);
			//return;
		}

		var balance = typeof(balance) == 'object' ? balance.result : balance;
		logger.info('Pot balance is %d %s', balance, settings.coin.short_name);
		timebomb.potBalance = balance;
	});

	// update pot balance
	coin.getBalance(timebomb.rainPotAccountName, settings.coin.min_confirmations, function(err, balance) {
		if(err) {
			logger.error('Could not connect to %s RPC API! ', settings.coin.full_name, err);
			//process.exit(1);
			//return;
		}

		var balance = typeof(balance) == 'object' ? balance.result : balance;
		logger.info('Rain pot balance is %d %s', balance, settings.coin.short_name);
		timebomb.rainPotBalance = balance;
	});

	// get pot address
	coin.getAccountAddress(timebomb.potAccountName, function(err, address) {
		if(err) {
			logger.error('Could not account address!');
			//process.exit(1);
			//return;
		}

		logger.info('Pot address is %s', address);
	});

	// get rainpot address
	coin.getAccountAddress(timebomb.rainPotAccountName, function(err, address) {
		if(err) {
			logger.error('Could not account address!');
			//process.exit(1);
			//return;
		}

		logger.info('Rain Pot address is %s', address);
	});

    return {
        run: function (from, channel, message) {
			var match = message.match(/^(!?)(\S+)/);
			if(match == null) return;
			var prefix  = match[1];
			var command = match[2];

			switch(command) {
				case 'bomb':
					var match = message.match(/^.?bomb (\S+)$/);
					if(match == null) {
						ircClient.say(channel, timebomb.i18n.usage.expand({min_bet: settings.timebomb.minBet, max_bet: settings.timebomb.maxBet}));
						return;
					}

					// if game is in progress - display player and time left, exit
					if (timebomb.gameInProgress) {
						var timeLeft = timebomb.getTimeLeft(timebomb.explodeTime);
						if (timeLeft>0) {
							ircClient.say(channel, timebomb.i18n.bombalreadyactivated.expand({player: timebomb.player, timeLeft: timeLeft}));
						} else {
							ircClient.say(channel, timebomb.i18n.gameinprogress.expand({player: timebomb.player}));
						}
						return;
					}

					// check if bet is a number
					var bet = parseFloat(match[1]);
					if (isNaN(bet)) {
						ircClient.say(channel, timebomb.i18n.usage.expand({min_bet: settings.timebomb.minBet, max_bet: settings.timebomb.maxBet}));
						return;
					}

					// if there is no game, check if balance is enough to start a new game
					if (timebomb.canStartGame(bet)) {
						logger.info(from + ' starting new time bomb game with ' + bet + ' bet');
						timebomb.startGame(channel, from, bet);
					} else {
						ircClient.say(channel, timebomb.i18n.nofundsinpottostart);
						logger.info('Cannot start new game, pot too low on funds');
					}
					break;
				case 'again':
					if (timebomb.canDecideOnGame(from)) {
						timebomb.resumeGame();
					}
					break;
				case 'stop':
					if (timebomb.canDecideOnGame(from)) {
						timebomb.resignGame();
					}
					break;
				case 'cutwire':
					if (timebomb.canCutWire(from)) {
						var match = message.match(/^.?cutwire (\S+)$/);
						if (match == null) {
							ircClient.say(channel, timebomb.i18n.cutwireusage);
							return;
						}
						var color = match[1];
						color = color.toLowerCase();
						if (timebomb.hasWire(color)) {
							logger.info(from + ' cuts ' + color + ' wire...');
							timebomb.cutWire(color);
						} else {
							ircClient.say(channel, timebomb.i18n.nosuchcolor);
						}
					} else {
						logger.error('You cannot cut wires!');
					}
					break;
			}
        },
        commands: ['bomb', 'again', 'stop', 'cutwire']
    };

};
