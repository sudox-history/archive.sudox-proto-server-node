"use strict";
const EventEmitter = require("events");
const crypto = require("sudox-crypto-node");

const _PACK_NAME = "hsk";

const _OK = Buffer.from("ok");
const _ECDSA_PRIVATE_KEY = crypto.ECDSA.parseKey(__dirname + "/../keys/ecdsa-private.key", "private");

/**
 * @param {module:net.Socket} tcpSocket
 * @param {TCPDuplexer} tcpDuplexer
 * @constructor
 * @extends {NodeJS.EventEmitter}
 */
function Handshake(tcpSocket, tcpDuplexer) {
    // Extends EventEmitter
    EventEmitter.call(this);

    this._tcpSocket = tcpSocket;
    this._tcpDuplexer = tcpDuplexer;

    this._setHandlers();
}

/**
 * @param {Buffer} clientPublicKey
 * @returns {Handshake}
 */
Handshake.prototype._onPack = function (clientPublicKey) {
    let {index, publicKey} = crypto.ECDH.start();
    let secretKey = crypto.ECDH.finish(index, clientPublicKey);

    if (!secretKey) {
        this._tcpSocket.destroy();

        return this;
    }

    let okHmac = crypto.HMAC.compute(_OK, secretKey);
    let publicKeySign = crypto.ECDSA.compute(publicKey, _ECDSA_PRIVATE_KEY);

    this._tcpDuplexer.write(_PACK_NAME, publicKey, publicKeySign, okHmac);

    this.emit("upgrade", secretKey);
    return this;
};

/**
 * @returns {Handshake}
 */
Handshake.prototype._setHandlers = function () {
    this._tcpDuplexer
        .on(_PACK_NAME, this._onPack.bind(this));

    return this;
};

// Extends EventEmitter
Object.setPrototypeOf(Handshake.prototype, EventEmitter.prototype);

module.exports = Handshake;