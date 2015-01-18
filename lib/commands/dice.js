// <drew> !dice <amount>

// snake-eyes pays double
// <drew> doubles pays 1/2
// <drew> rest lose
// <drew> same thing
// <drew> to rain pot
// <ZeeWolf> any working examples ? i'm not gamble guy :)
// <drew> [02:56:40] <jwinterm> !dice 1999
// <drew> [02:56:41] <+CryptoRobot> jwinterm rolled a 10 (5 and 5) and won 1999.0 ZEIT.
// <drew> but thats double for a double
// <drew> shud be half
// <drew> <+CryptoRobot> CryptoBeaver rolled a 2 (1 and 1) and won 4000.0 ZEIT.
// <drew> the bet was obv 2000
// <drew> snake-eyes oays double
// <drew> snake-eyes pays double
// <drew> [02:58:33] <+CryptoRobot> jwinterm rolled a 8 (3 and 5) and did not win.
// <drew> [02:58:33] <+CryptoRobot> jwinterm rolled a 7 (6 and 1) and did not win.
// <drew> [02:58:33] <+CryptoRobot> jwinterm rolled a 7 (1 and 6) and did not win.
// <drew> [03:40:56] <sorrowfox> !dice 69
// <drew> [03:40:57] <+CryptoRobot> sorrowfox rolled a 8 (4 and 4) and did not win.
// <drew> shud have paid bet + 1/2


// <drew> dice 100 - snake-eyes - pays 200
// <drew> dice 100 - double pays 150
// <drew> we cud do 2 + 2 or 3+3 or 4+4 etc
// <drew> but ppl need to see the die numbers


// Rawnie rolled a 5 (4 and 1) and did not win.
// CryptoBeaver rolled a 2 (1 and 1) and won 4000.0 ZEIT.


var logger = require('winston'),
	Dice = require('../games/dice'),
	DEBUG_MODE = process.env.DEBUG_MODE==1 ? true : false;

module.exports = function (coin, ircClient, settings) {

	/* Dice events */
	var dice = new Dice(settings.dice, settings.messages.dice, coin);

	// set up events actions
	dice.on('rain', function(amountToRain) {
		var commands = require('../../tipbot').commands;
		ircClient.say(this.channel, this.i18n.potoverflow);
		logger.info(this.settings.rainPotAccountName + ' will now rain ' + amountToRain + ' to ' + this.channel);
		commands.rain(this.settings.rainPotAccountName, this.channel, '!rain ' + amountToRain);
	})
	.on('correct', function() {
		ircClient.say(this.channel, this.i18n.correct.expand({reward: this.playerBet * (this.settings.stakeMultiplicator-1), balance: this.playerBalance, fee: this.settings.fee}));
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
			ircClient.say(this.channel,'[debug] Rolled : ' + this.rolled);
		}
	});
	/* /Dice events */

	dice.updatePotsBalances(function(err, balances) {
		if(err) {
			logger.error('Could not connect to %s RPC API! ', settings.coin.full_name, err);
			return;
		}

		logger.info('Dice: Pot balance is %d %s', balances.pot, settings.coin.short_name);
	});


	// get pot address
	coin.getAccountAddress(dice.potAccountName, function(err, address) {
		if(err) {
			logger.error('Could not account address!');
		}

		logger.info('Dice: Pot address is %s', address);
	});

    return {
        run: function (from, channel, message) {
			var match = message.match(/^(!?)(\S+)/);
			if(match == null) return;
			var prefix  = match[1];
			var command = match[2];

			switch(command) {
				case 'dice':
					var match = message.match(/^.?dice (\S+)$/);
					if(match == null) {
						ircClient.say(channel, dice.i18n.usage.expand({min_bet: settings.dice.minBet, max_bet: settings.dice.maxBet}));
						return;
					}

					// check if bet is a number
					var bet = parseFloat(match[1]);
					if (isNaN(bet)) {
						ircClient.say(channel, dice.i18n.usage.expand({min_bet: settings.dice.minBet, max_bet: settings.dice.maxBet}));
						return;
					}

					// if there is no game, check if balance is enough to start a new game
					if (dice.canStartGame(bet)) {
						logger.info(from + ' starting new dice game with ' + bet + ' bet');
						dice.startGame(channel, from, bet);
					} else {
						ircClient.say(channel, dice.i18n.nofundsinpottostart);
						logger.info('Cannot start new game, pot too low on funds');
					}
					break;
				case 'dicepot':
					dice.updatePotsBalances(function(err, balances) {
						if (err) {
							logger.error('Could not get pots balances!');
							return;
						}

						ircClient.say(channel, dice.i18n.potinfo.expand({rain_pot_balance: balances.rainPot, pot_balance: balances.pot, max_rain_fund: dice.settings.maxPot}));
					});
					break;
			}
        },
        commands: ['dice', 'dicepot']
    };

};
