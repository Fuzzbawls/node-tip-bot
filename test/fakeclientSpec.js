//setup
var expect = require("chai").expect;
var FakeClient = require("../lib/fake-client");

describe('FakeClient', function() {
	var fakeclient;
	var bobAccountName = 'bob';
	var janeAccountName = 'jane';
	var trevorAccountName = 'trevor';
	var bobAccount, janeAccount, trevorAccount;

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
			var bobAccount = fakeclient.createNewAccount(bobAccountName);
			expect(bobAccount).to.have.property('address');
			expect(bobAccount).to.have.property('balance');
			expect(bobAccount.balance).to.equal(0);
		});

		it('#getAccountAddress should return account\'s address correctly', function() {
			var bobAccountAddress = fakeclient.getAccountAddress(bobAccountName);
			expect(bobAccountAddress).to.have.length(34);
		});

		it('#getAccountBalance should return account\'s balance correctly', function() {
			var balance = fakeclient.getAccountBalance(bobAccountName);
			expect(balance).to.equal(0);
		});

		it('#incomingTx should increase account\'s balance correctly', function() {
			fakeclient.incomingTx(bobAccountName, 10);
			var balance = fakeclient.getAccountBalance(bobAccountName);
			expect(balance).to.equal(10);
		});

	});

	describe('RPC method', function() {
		beforeEach(function() {
			fakeclient = new FakeClient();
			bobAccount = fakeclient.createNewAccount(bobAccountName);
			janeAccount = fakeclient.createNewAccount(janeAccountName);
			trevorAccount = fakeclient.createNewAccount(trevorAccountName);

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
			fakeclient.getBalance(bobAccountName, 0, function(err, balance) {
				expect(balance).to.equal(0);
				done();
			});
		});


		// coin.send('getaccountaddress', nickname.toLowerCase(), function(err, address)
		it('#send getaccountaddress should return account address correctly', function(done) {
			fakeclient.send('getaccountaddress', bobAccountName, function(err, address) {
				expect(address).to.have.length(34);
				done();
			});
		});

		// coin.send('getaccountaddress', nickname.toLowerCase(), function(err, address)
		it('#send move should move coins correctly', function(done) {
			fakeclient.incomingTx(bobAccountName, 10);
			fakeclient.send('move', bobAccountName, janeAccountName, 10, function(err, result) {
				expect(err).to.be.not.ok;
				expect(result).to.be.ok;
				var bobBalance = fakeclient.getAccountBalance(bobAccountName);
				var janeBalance = fakeclient.getAccountBalance(janeAccountName);
				expect(bobBalance).to.equal(0);
				expect(janeBalance).to.equal(10);
				done();
			});
		});

		// coin.sendFrom(from, toAddress, amount, function(err, txid)
		it('#sendFrom should return correct tx id', function(done) {
			fakeclient.incomingTx(bobAccountName, 10);

			fakeclient.sendFrom(bobAccountName, janeAccount.address, 10, function(err, txid) {
				expect(err).to.be.not.ok;
				expect(txid).to.equal(fakeclient.fakeTxId);
				var bobBalance = fakeclient.getAccountBalance(bobAccountName);
				var janeBalance = fakeclient.getAccountBalance(janeAccountName);
				expect(bobBalance).to.equal(0);
				expect(janeBalance).to.equal(10);
				done();
			});
		});

		// coin.sendMany(from.toLowerCase(), addresses, function(err, txId)
		it('#sendMany should update known addresses with correct amounts', function(done) {
			fakeclient.incomingTx(bobAccountName, 16);

			var manyAddresses = {};
			manyAddresses[fakeclient.getAccountAddress(janeAccountName)] = 2;
			manyAddresses[fakeclient.getAccountAddress(trevorAccountName)] = 8;

			fakeclient.sendMany(bobAccountName, manyAddresses, function(err, txid) {
				expect(err).to.be.not.ok;
				expect(txid).to.equal(fakeclient.fakeTxId);
				var bobBalance = fakeclient.getAccountBalance(bobAccountName);
				var janeBalance = fakeclient.getAccountBalance(janeAccountName);
				var trevorBalance = fakeclient.getAccountBalance(trevorAccountName);
				expect(bobBalance).to.equal(6);
				expect(janeBalance).to.equal(2);
				expect(trevorBalance).to.equal(8);
				done();
			});
		});

	});

	describe('#move method', function() {

		before(function() {
			fakeclient = new FakeClient();
			var bob = fakeclient.createNewAccount(bobAccountName);
			var jane = fakeclient.createNewAccount(janeAccountName);
		});

		it('with 0 balance should be not ok', function() {
			var result = fakeclient.moveCoins(bobAccountName, janeAccountName, 10);
			expect(result).to.be.not.ok;
		});

		it('with some balance should move fund correctly', function() {
			fakeclient.incomingTx(bobAccountName, 10);
			var result = fakeclient.moveCoins(bobAccountName, janeAccountName, 10);
			expect(result).to.be.ok;
		});

	});

});
