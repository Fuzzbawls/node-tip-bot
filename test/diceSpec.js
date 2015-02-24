//setup
var chai = require("chai");
var expect = chai.expect;
var spies = require('chai-spies');
var Dice = require("../lib/games/dice");
var dice;
var channelName = 'channel';
var playerName = 'bob';
var playerBet = 5;
var rolled;

chai.use(spies);

describe('Dice', function() {

	xdescribe('#startGame should set', function() {

		before(function(done) {
			dice = new Dice({}, {});
		});

		it('gameinProgress flag correctly', function() {
			expect(timebomb.gameInProgress).to.equal(true);
		});

		it('playerBet correctly', function() {
			expect(timebomb.playerBet).to.equal(playerBet);
		});

		it('channel correctly', function() {
			expect(timebomb.channel).to.equal(channelName);
		});

		it('round correctly', function() {
			expect(timebomb.round).to.equal(1);
		});

		it('timerHandle correctly', function() {
			expect(timebomb.timerHandle).to.not.be.a.null;
		});

		it('wiresColors correctly', function() {
			expect(timebomb.wiresColors).to.have.length.within(3,6);
		});

		it('correctWire correctly', function() {
			expect(timebomb.correctWire).to.have.length.above(1);
		});

	});

    // <drew> snake-eyes pays double
    // <drew> doubles pays 1/2
    // <drew> rest lose

	describe.only('#getReward should detect', function() {

		beforeEach(function() {
			dice = new Dice();
		});

		it('snake-eyes and pay double of bet', function() {
			var payoutModifier = dice.getReward(1,1);
			expect(payoutModifier).to.equal(2);
		});

		it('doubles (2-2) and pay half of bet', function() {
			var payoutModifier = dice.getReward(2,2);
			expect(payoutModifier).to.equal(0.5);
		});

		it('the rest combinations - lose', function() {
			var payoutModifier = dice.getReward(2,5);
			expect(payoutModifier).to.equal(0);
		});

	});


});
