"use strict";
const Queue = require("../utils/queue");
const serialization = require("../utils/serialization");

const PACK_HEAD_LEN = 2;

/**
 * @param {NodeJS.EventEmitter} events
 * @param {module:net.Socket} tcpSocket
 * @constructor
 */
function TCPDuplexer(events, tcpSocket) {
    this._events = events;
    this._tcpSocket = tcpSocket;

    this._packLen = 0;

    this._crowded = false;
    this._queue = new Queue();

    this._setHandlers();
}

/**
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype._read = function () {
    while (true) {
        if (this._packLen) {
            if (this._tcpSocket.readableLength < this._packLen) {
                break;
            }

            let packBodyBuf = this._tcpSocket.read(this._packLen);
            this._packLen = 0;

            try {
                // noinspection ES6ConvertVarToLetConst
                var pack = serialization.deserialize(packBodyBuf, false);
            } catch (e) {
                // Do nothing because we just avoiding exception
            }

            this._events.emit(`packs:${pack[0]}`, ...pack.slice(1));
        } else {
            if (this._tcpSocket.readableLength < PACK_HEAD_LEN) {
                break;
            }

            this._packLen = this._tcpSocket
                .read(PACK_HEAD_LEN)
                .readUIntLE(0, PACK_HEAD_LEN);
        }
    }

    return this;
};

/**
 * @param {*} pack
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype._write = function (...pack) {
    if (this._crowded) {
        this._queue.enqueue(pack);

        return this;
    }

    let packBodyBuf = serialization.serialize(pack, true, PACK_HEAD_LEN);
    this._crowded = !this._tcpSocket.write(packBodyBuf);

    return this;
};

/**
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype._writeEnqueued = function () {
    this._crowded = false;

    let queue = this._queue.dequeue();
    let queueLen = queue.length;

    for (let i = 0; i < queueLen; i++) {
        this._write(...queue[i]);
    }

    return this;
};

/**
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype._setHandlers = function () {
    this._events
        .on("packs:write", this._write.bind(this));

    this._tcpSocket
        .on("readable", this._read.bind(this))
        .on("drain", this._writeEnqueued.bind(this));

    return this;
};

module.exports = TCPDuplexer;