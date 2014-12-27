//setup
var expect = require("chai").expect;
var FakeClient = require("../lib/fake-client");

describe('FakeClient', function() {
	var fakeclient;
	var testAccount1 = 'bob';
	var testAccount2 = 'jane';

	describe('core method', function() {
		before(function() {
			fakeclient = new FakeClient();
		});

		it('#getPseudoAddress should generate base58 addresses', function() {
			var address = fakeclient.getPseudoAddress();
			expect(address).to.have.length(34);
		});

		it('#validate should validate base58 addresses', function() {
			var address = fakeclient.getPseudoAddress();
			var result = fakeclient.validate(address);
			expect(result).to.be.ok;
		});

		it('#createNewAccount should create account correctly', function() {
			var account = fakeclient.createNewAccount(testAccount1);
			expect(account).to.have.property('address');
			expect(account).to.have.property('balance');
			expect(account.balance).to.equal(0);
		});

		it('#getAccountAddress should return account\'s address correctly', function() {
			var address = fakeclient.getAccountAddress(testAccount1);
			expect(address).to.have.length(34);
		});

		it('#getAccountBalance should return account\'s balance correctly', function() {
			var balance = fakeclient.getAccountBalance(testAccount1);
			expect(balance).to.equal(0);
		});

		it('#incomingTx should increase account\'s balance correctly', function() {
			fakeclient.incomingTx(testAccount1, 10);
			var balance = fakeclient.getAccountBalance(testAccount1);
			expect(balance).to.equal(10);
		});

	});

	describe('RPC method', function() {
		before(function() {
			fakeclient = new FakeClient();
		});
		// RPC
		it('#getBalance should return total wallet balance correctly', function(done) {
			fakeclient.getBalance(function(err, balance) {
				expect(balance).to.equal(0);
				done();
			});
		});

		// coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
		it('#getBalance with min conf should return total wallet balance correctly', function(done) {
			fakeclient.getBalance(testAccount1, 0, function(err, balance) {
				expect(balance).to.equal(0);
				done();
			});
		});


		// coin.send('getaccountaddress', nickname.toLowerCase(), function(err, address)
		it('#send getaccountaddress should return account address correctly', function(done) {
			fakeclient.send('getaccountaddress', testAccount1, function(err, address) {
				expect(address).to.have.length(34);
				done();
			});
		});

		// coin.send('getaccountaddress', nickname.toLowerCase(), function(err, address)
		it('#send move should move coins correctly', function(done) {
			fakeclient.incomingTx(testAccount1, 10);
			fakeclient.send('move', testAccount1, testAccount2, 10, function(err, result) {
				expect(err).to.be.not.ok;
				expect(result).to.be.ok;
				var account1balance = fakeclient.getAccountBalance(testAccount1);
				var account2balance = fakeclient.getAccountBalance(testAccount2);
				expect(account1balance).to.equal(0);
				expect(account2balance).to.equal(10);
				done();
			});
		});
	});

	describe('#move method', function() {

		before(function() {
			fakeclient = new FakeClient();
			var bob = fakeclient.createNewAccount(testAccount1);
			var jane = fakeclient.createNewAccount(testAccount2);
		});

		it('with 0 balance should be not ok', function() {
			var result = fakeclient.moveCoins(testAccount1, testAccount2, 10);
			expect(result).to.be.not.ok;
		});

		it('with some balance should move fund correctly', function() {
			fakeclient.incomingTx(testAccount1, 10);
			var result = fakeclient.moveCoins(testAccount1, testAccount2, 10);
			expect(result).to.be.ok;
		});

	});

});
