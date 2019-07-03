"use strict";
const scrypto = require("scrypto-nodejs");
const Queue = require("../utils/queue");
const serialization = require("../utils/serialization");

const _PACK_NAME = "msg";

/**
 * @param {NodeJS.EventEmitter} events
 * @param {module:net.Socket} tcpSocket
 * @constructor
 */
function Messaging(events, tcpSocket) {
    this._events = events;
    this._tcpSocket = tcpSocket;

    this._secretKey = null;
    this._queue = new Queue();

    this._setHandlers();
}

/**
 * @param {Buffer} payload
 * @param {Buffer} payloadHMAC
 * @param {Buffer} iv
 * @returns {Messaging}
 */
Messaging.prototype._read = function (payload, payloadHMAC, iv) {
    if (!scrypto.HMAC.verify(payload, this._secretKey, payloadHMAC)) {
        this._tcpSocket.destroy();

        return this;
    }

    try {
        let messageBuf = scrypto.AES.decrypt(payload, this._secretKey, iv);
        messageBuf = scrypto.utils.salt.remove(messageBuf);

        // noinspection ES6ConvertVarToLetConst
        var message = serialization.deserialize(messageBuf, false);
    } catch (e) {
        // Do nothing because we just avoid exception
    }

    this._events.emit("messages:new", message);
    return this;
};

/**
 * @param {*[]} message
 * @returns {Messaging}
 */
Messaging.prototype._write = function (message) {
    if (!this._secretKey) {
        this._queue.enqueue(message);

        return this;
    }

    let messageBuf = serialization.serialize(message, false);
    messageBuf = scrypto.utils.salt.add(messageBuf);

    let iv = scrypto.utils.rand.genBuf(16);

    let payload = scrypto.AES.encrypt(messageBuf, this._secretKey, iv);
    let payloadHMAC = scrypto.HMAC.compute(payload, this._secretKey);

    this._events.emit("packs:write", _PACK_NAME, payload, payloadHMAC, iv);

    return this;
};

/**
 * @param {Buffer} secretKey
 * @returns {Messaging}
 */
Messaging.prototype._writeEnqueued = function (secretKey) {
    this._secretKey = secretKey;

    let queue = this._queue.dequeue();
    let queueLen = queue.length;

    for (let i = 0; i < queueLen; i++) {
        this._write(queue[i]);
    }

    return this;
};

/**
 * @returns {boolean}
 */
Messaging.prototype._setHandlers = function () {
    this._events
        .on(`packs:${_PACK_NAME}`, this._read.bind(this))
        .on("messages:write", this._write.bind(this))
        .on("managers:upgrade", this._writeEnqueued.bind(this));

    return this;
};

module.exports = Messaging;
