"use strict";
const EventEmitter = require("events");
const notation = require("sudox-notation-node");
const Queue = require("../utils/queue");

const _PACK_HEAD_LEN = 3;

/**
 * @param {module:net.Socket} tcpSocket
 * @constructor
 * @extends {NodeJS.EventEmitter}
 */
function TCPDuplexer(tcpSocket) {
    this._tcpSocket = tcpSocket;

    this._queue = new Queue();
    this._canWrite = true;

    this._packBodyLen = 0;
    this._setHandlers();
}

/**
 * @param {*} pack
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype.write = function (...pack) {
    if (!this._canWrite) {
        this._queue.enqueue(pack);

        return this;
    }

    let packBuf = notation.serialize(pack, _PACK_HEAD_LEN);
    packBuf.writeUIntLE(packBuf.length - _PACK_HEAD_LEN, 0, _PACK_HEAD_LEN);

    this._canWrite = this._tcpSocket.write(packBuf);
    return this;
};

/**
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype._onDrain = function () {
    this._canWrite = true;

    let packs = this._queue.dequeue();
    let packsLen = packs.length;

    for (let i = 0; i < packsLen; i++) {
        this.write.apply(this, packs[i]);
    }

    return this;
};

/**
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype._onReadable = function () {
    while (true) {
        if (this._packBodyLen) {
            if (this._tcpSocket.readableLength < this._packBodyLen) {
                break;
            }

            let packBodyBuf = this._tcpSocket.read(this._packBodyLen);
            this._packBodyLen = 0;

            let pack;

            try {
                pack = notation.deserialize(packBodyBuf);
            } catch (e) {
                continue;
            }

            this.emit.apply(this, pack);
        } else {
            if (this._tcpSocket.readableLength < _PACK_HEAD_LEN) {
                break;
            }

            this._packBodyLen = this._tcpSocket
                .read(_PACK_HEAD_LEN)
                .readUIntLE(0, _PACK_HEAD_LEN);
        }
    }

    return this;
};

/**
 * @returns {TCPDuplexer}
 */
TCPDuplexer.prototype._setHandlers = function () {
    this._tcpSocket
        .on("drain", this._onDrain.bind(this))
        .on("readable", this._onReadable.bind(this));

    return this;
};

// Extends EventEmitter
Object.setPrototypeOf(TCPDuplexer.prototype, EventEmitter.prototype);

module.exports = TCPDuplexer;