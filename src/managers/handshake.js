"use strict";
const scrypto = require("scrypto-nodejs");

const _PACK_NAME = "hsk";

const _OK = Buffer.from("ok");
const _ECDSA_PRIVATE_KEY = scrypto.ECDSA.parseKey(__dirname + "/../keys/ecdsa-private.key", "private");

/**
 * @param {NodeJS.EventEmitter} events
 * @param {module:net.Socket} tcpSocket
 * @constructor
 */
function Handshake(events, tcpSocket) {
    this._events = events;
    this._tcpSocket = tcpSocket;

    this._setHandlers();
}

/**
 * @param {Buffer} clientPublicKey
 * @returns {Handshake}
 */
Handshake.prototype._doHandshake = function (clientPublicKey) {
    let ecdh = new scrypto.ECDH();
    let secretKey = ecdh.computeSecretKey(clientPublicKey);

    if (!secretKey) {
        this._tcpSocket.destroy();

        return this;
    }

    let okHmac = scrypto.HMAC.compute(_OK, secretKey);

    let publicKey = ecdh.getPublicKey();
    let publicKeySign = scrypto.ECDSA.compute(publicKey, _ECDSA_PRIVATE_KEY);

    this._events.emit("packs:write", _PACK_NAME, publicKey, publicKeySign, okHmac);
    this._events.emit("managers:upgrade", secretKey);

    return this;
};

/**
 * @returns {Handshake}
 */
Handshake.prototype._setHandlers = function () {
    this._events
        .on(`packs:${_PACK_NAME}`, this._doHandshake.bind(this));

    return this;
};

module.exports = Handshake;