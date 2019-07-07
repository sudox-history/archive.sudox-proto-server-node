"use strict";
const EventEmitter = require("events");
const scrypto = require("scrypto-nodejs");
const snotation = require("snotation-nodejs");
const Queue = require("../utils/queue");

const _PACK_NAME = "msg";

/**
 * @param {module:net.Socket} tcpSocket
 * @param {TCPDuplexer} tcpDuplexer
 * @param {Handshake} handshake
 * @constructor
 * @extends {NodeJS.EventEmitter}
 */
function Messaging(tcpSocket, tcpDuplexer, handshake) {
    // Extends EventEmitter
    EventEmitter.call(this);

    this._tcpSocket = tcpSocket;
    this._tcpDuplexer = tcpDuplexer;

    this._handshake = handshake;

    this._queue = new Queue();
    this._secretKey = null;

    this._setHandlers();
}

/**
 * @param {*[]} message
 * @returns {Messaging}
 */
Messaging.prototype.write = function (message) {
    if (!this._secretKey) {
        this._queue.enqueue(message);

        return this;
    }

    let messageBuf = snotation.serialize(message);
    messageBuf = scrypto.salt.add(messageBuf);

    let iv = scrypto.rand.genBuf(8);
    let counter = Buffer.concat([iv, Buffer.alloc(8)]);

    let payload = scrypto.AES.encrypt(messageBuf, this._secretKey, counter);
    let payloadHMAC = scrypto.HMAC.compute(payload, this._secretKey);

    this._tcpDuplexer.write(_PACK_NAME, payload, payloadHMAC, iv);

    return this;
};

/**
 * @param {Buffer} secretKey
 * @returns {Messaging}
 */
Messaging.prototype._onUpgrade = function (secretKey) {
    this._secretKey = secretKey;

    let messages = this._queue.dequeue();
    let messagesLen = messages.length;

    for (let i = 0; i < messagesLen; i++) {
        this.write(messages[i]);
    }

    return this;
};

/**
 * @param {Buffer} payload
 * @param {Buffer} payloadHMAC
 * @param {Buffer} iv
 * @returns {Messaging}
 */
Messaging.prototype._onPack = function (payload, payloadHMAC, iv) {
    if (!scrypto.HMAC.verify(payload, this._secretKey, payloadHMAC)) {
        this._tcpSocket.destroy();

        return this;
    }

    let counter = Buffer.concat([iv, Buffer.alloc(8)]);
    let messageBuf = scrypto.AES.decrypt(payload, this._secretKey, counter);

    if (!messageBuf) {
        return this;
    }

    messageBuf = scrypto.salt.remove(messageBuf);
    let message;

    try {
        message = snotation.deserialize(messageBuf, 0);
    } catch (e) {
        return this;
    }

    this.emit("message", message);
    return this;
};

/**
 * @returns {boolean}
 */
Messaging.prototype._setHandlers = function () {
    this._handshake
        .once("upgrade", this._onUpgrade.bind(this));

    this._tcpDuplexer
        .on(_PACK_NAME, this._onPack.bind(this));

    return this;
};

// Extends EventEmitter
Object.setPrototypeOf(Messaging.prototype, EventEmitter.prototype);

module.exports = Messaging;
