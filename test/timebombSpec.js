//setup
var chai = require("chai");
var expect = chai.expect;
var spies = require('chai-spies');
var TimeBomb = require("../lib/timebomb");
var timebomb;
var channelName = 'channel';
var playerName = 'bob';
var playerBet = 5;
var correctWire;

chai.use(spies);

xdescribe('Timebomb', function() {

	describe('#startGame should set', function() {

		before(function(done) {
			timebomb = new TimeBomb({}, {});
			timebomb.startGame(channelName, playerName, playerBet, function() {
				done();
			});
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

	describe('game is active so', function() {

		before(function(done) {
			timebomb = new TimeBomb({}, {});
			timebomb.startGame(channelName, playerName, playerBet, function() {
				done();
			});
		});

		it('no other user can start new game', function() {
			expect(function() {
				timebomb.startGame(channelName, 'other_user', playerBet);
			}).to.throw(Error);
		});


	});

	describe('#wireCut should detect', function() {

		beforeEach(function() {
			timebomb = new TimeBomb({}, {});
			timebomb.startGame(channelName, playerName, playerBet);
		});

		it('correct cut', function() {
			var spy = chai.spy();
			timebomb.on('correct', spy);
			var cutResult = timebomb.cutWire(timebomb.correctWire);
			expect(cutResult).to.be.ok;
			expect(spy).to.have.been.called();
		});

		it('incorrect cut', function() {
			var cutResult = timebomb.cutWire('incorrectcolorname');
			expect(cutResult).to.not.be.ok;
		});

	});

	describe('#hasWire', function() {

		beforeEach(function() {
			timebomb = new TimeBomb({}, {});
			timebomb.startGame(channelName, playerName, playerBet);
		});

		it('should return true if there is such wire', function() {
			expect(timebomb.hasWire(timebomb.correctWire)).to.be.ok;
			expect(timebomb.hasWire('pope redish')).to.not.be.ok;
		});
	});

});

xdescribe('Scenario 1:', function() {

	before(function() {
		timebomb = new TimeBomb({}, {});
	});

	it('user starts game - bets 5', function() {
		timebomb.startGame(channelName, playerName, playerBet);
		expect(timebomb.gameInProgress).to.equal(true);
		expect(timebomb.gameInProgress).to.equal(true);
	});

	it('user bets on correct wire - balance should be doubled', function() {
		timebomb.cutWire(timebomb.correctWire);
		expect(timebomb.playerBalance).to.equal(timebomb.playerBet * timebomb.settings.stakeMultiplicator);
	});

	it('user bets on correct wire - balance should be doubled (again)', function() {
		timebomb.resumeGame();
		timebomb.cutWire(timebomb.correctWire);
		expect(timebomb.playerBalance).to.equal(timebomb.playerBet * timebomb.settings.stakeMultiplicator);
	});

	it('user resigns', function(done) {
		timebomb.resignGame(function(err, status) {
			expect(err).to.equal(false);
			expect(status).to.equal(true);
			expect(timebomb.playerBalance).to.equal(0);
			done();
		});
	});

});
