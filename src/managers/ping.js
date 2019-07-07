"use strict";
const _PACK_NAME = "png";

const _TIMEOUT = 6000;
const _CHECK_TIMEOUT = 200000;

/**
 * @param {module:net.Socket} tcpSocket
 * @param {TCPDuplexer} tcpDuplexer
 * @constructor
 */
function Ping(tcpSocket, tcpDuplexer) {
    this._tcpSocket = tcpSocket;
    this._tcpDuplexer = tcpDuplexer;

    this._alive = true;
    this._timeout = null;

    this._setTimeout()._setHandlers();
}

/**
 * @returns {Ping}
 */
Ping.prototype._setTimeout = function () {
    let timeoutHandler = () => {
        this._alive = false;
        this._tcpDuplexer.write(_PACK_NAME);

        setTimeout(checkTimeoutHandler, _CHECK_TIMEOUT);
    };

    let checkTimeoutHandler = () => {
        if (!this._alive) {
            this._tcpSocket.destroy();
        }
    };

    this._timeout = setTimeout(timeoutHandler, _TIMEOUT);
    return this;
};

/**
 * @returns {Ping}
 */
Ping.prototype._onPack = function () {
    if (this._alive) {
        this._tcpDuplexer.write(_PACK_NAME);

        return this;
    }

    this._alive = true;
    return this;
};

/**
 * @returns {Ping}
 */
Ping.prototype._onReadable = function () {
    this._timeout.refresh();

    return this;
};

/**
 * @returns {Ping}
 */
Ping.prototype._onClose = function () {
    clearTimeout(this._timeout);

    return this;
};

/**
 * @returns {Ping}
 */
Ping.prototype._setHandlers = function () {
    this._tcpDuplexer
        .on(_PACK_NAME, this._onPack.bind(this));

    this._tcpSocket
        .prependListener("readable", this._onReadable.bind(this))
        .on("close", this._onClose.bind(this));

    return this;
};

module.exports = Ping;