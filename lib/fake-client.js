/**
 * Fake bitcoin daemon/client
 * Provides same API as node-bitcoind client but doesn't communicate with real daemon
 * @param {object} opt Settings
 */
function FakeClient(opt) {
	if (!(this instanceof FakeClient)) {
		return new FakeClient(opt);
	}
	this.accounts = {};
	this.addresses = {};
	this.opt = opt;
	// create total account (by getting it's balance)
	this.getAccountBalance('total');
	this.fakeTxId = '123asdf8ghhd78d89s98x98vc7sdf7879sdf9879';
}

FakeClient.prototype.getPseudoAddress = function() {
	var addressLength = 34,
		base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
		address = '',
		max = base58.length-1;
	while(addressLength--) {
		address += base58[0|Math.random()*max];
	}
	return address;
}

FakeClient.prototype.createNewAccount = function(accountName) {
	var address = this.getPseudoAddress();
	this.addresses[address] = {
		address: address,
		balance: 0
	};

	this.accounts[accountName] = this.addresses[address];
	return this.accounts[accountName];
}


FakeClient.prototype.createNewAddress = function(address) {
	this.addresses[address] = {
		address: address,
		balance: 0
	};

	this.accounts[address] = this.addresses[address];
	return this.accounts[address];
}

FakeClient.prototype.getAccountAddress = function(accountName) {
	if (!this.accounts[accountName]) {
		this.createNewAccount();
	}
	return this.accounts[accountName].address;
}

FakeClient.prototype.getAccountBalance = function(accountName) {
	if (!this.accounts[accountName]) {
		this.createNewAccount(accountName);
	}
	return this.accounts[accountName].balance;
}

FakeClient.prototype.moveCoins = function(fromAccount, toAccount, value) {
	if (this.getAccountBalance(fromAccount) >= value) {
		this.accounts[fromAccount].balance -= value;
		// touch destination to make sure it exists
		this.getAccountBalance(toAccount);
		this.accounts[toAccount].balance += value;
	} else {
		return false;
		throw new Error('Balance is not enough');
	}
	return true;
}

FakeClient.prototype.getAccountByAddress = function(address) {
	for (var account in this.accounts) {
		if (this.accounts[account].address === address) {
			return this.accounts[account];
		}
	}

	return false;
}

FakeClient.prototype.sendCoinsFromAccountToAddress = function(fromAccount, toAddress, value) {

	if (this.getAccountBalance(fromAccount) >= value) {

		this.accounts[fromAccount].balance -= value;

		// touch destination to make sure it exists
		var account = this.getAccountByAddress(toAddress);
		if (!account) {
			this.createNewAddress(toAddress);
			this.accounts[toAddress].balance += value;
		} else {
			account.balance += value;
		}
	} else {
		return false;
		throw new Error('Balance is not enough');
	}
	return true;
}

FakeClient.prototype.listAccounts = function() {
	return this.accounts;
}

FakeClient.prototype.validate = function(address) {
	return true;
}

// RPC

FakeClient.prototype.getMiningInfo = function(callback) {
	var miningInfo = {
	    'blocks' : 252054,
	    'currentblocksize' : 1000,
	    'currentblocktx' : 0,
	    'PoS difficulty' : 17.65507023,
	    'errors' : '',
	    'pooledtx' : 1,
	    'testnet' : false
	};
	callback(null, miningInfo);
}

FakeClient.prototype.getInfo = function(callback) {
	var info = {
	    'version' : 'v1.1-24-g6bed18d',
	    'protocolversion' : 72001,
	    'walletversion' : 60000,
	    'balance' : 123456.678046,
	    'newmint' : 0.00000000,
	    'stake' : 0.00000000,
	    'blocks' : 252054,
	    'moneysupply' : 129314839.86913601,
	    'connections' : 16,
	    'proxy' : '',
	    'ip' : '1.2.3.4',
	    'difficulty' : 17.65507023,
	    'testnet' : false,
	    'keypoololdest' : 1419202801,
	    'keypoolsize' : 101,
	    'paytxfee' : 0.00001000,
	    'unlocked_until' : 1425857769,
	    'errors' : ''
	};
	callback(null, info);
}

// RPC coin.getBalance
// coin.getBalance(from.toLowerCase(), settings.coin.min_confirmations, function(err, balance) {
// coin.getBalance(function(err, balance) {
FakeClient.prototype.getBalance = function(account, minConf, callback) {
	if (typeof account === 'function') {
		callback = account;
		minConf = 0;
		account = 'total'
	}
	callback(null, this.getAccountBalance(account));
}

FakeClient.prototype.send = function(method) {
	switch(method) {
		case 'getaccountaddress':
			// coin.send('getaccountaddress', nickname.toLowerCase(), function(err, address)
			var callback = arguments[2];
			callback(null, this.getAccountAddress(arguments[1]));
		break;
		case 'move':
			// coin.send('move', from.toLowerCase(), to.toLowerCase(), amount, function(err, reply) {
			var callback = arguments[4];
			if (this.moveCoins(arguments[1],arguments[2],arguments[3])) {
				callback(null, true);
			} else {
				callback(true, null);
			}
		break;
		default:
			//callback(true, null);
	}
}

FakeClient.prototype.move = function(fromAccount, toAccount, value, callback) {
	if (typeof callback !== 'function') {
		callback = function(){};
	}
	if (this.moveCoins(fromAccount, toAccount, value)) {
		callback(null, true);
	} else {
		callback(true, null);
	}
}

FakeClient.prototype.incomingTx = function(accountName, value) {
	if (!this.accounts[accountName]) {
		this.createNewAccount(accountName);
	}
	this.accounts[accountName].balance += value;
	this.accounts['total'].balance += value;
}

// coin.validateAddress(address, function(err, reply) {
FakeClient.prototype.validateAddress = function(address, callback) {
	callback(null, {isvalid: this.validate(address)});
}

// coin.sendFrom(from.toLowerCase(), address, balance - settings.coin.withdrawal_fee, function(err, reply)
FakeClient.prototype.sendFrom = function(fromAccount, toAddress, value, callback) {
	if (typeof callback !== 'function') {
		callback = function(){};
	}

	if (this.sendCoinsFromAccountToAddress(fromAccount, toAddress, value)) {
		callback(null, this.fakeTxId);
		return this.fakeTxId;
	} else {
		callback(true, null);
		return false;
	}
}

// coin.sendMany(from.toLowerCase(), address, balance - settings.coin.withdrawal_fee, function(err, txId)
FakeClient.prototype.sendMany = function(fromAccount, addresses, callback) {
	var error = false;
	if (typeof callback !== 'function') {
		callback = function(){};
	}

	for (var address in addresses) {
		if (!this.sendCoinsFromAccountToAddress(fromAccount, address, addresses[address])) {
			error = true;
			break;
		}
	}

	if (!error) {
		callback(null, this.fakeTxId);
	} else {
		callback(true, null);
	}

}

module.exports = FakeClient;
