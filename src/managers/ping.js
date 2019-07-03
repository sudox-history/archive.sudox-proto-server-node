"use strict";
const _PACK_NAME = "png";

const _TIMEOUT = 6000;
const _CHECK_TIMEOUT = 200000;

/**
 * @param {NodeJS.EventEmitter} events
 * @param {module:net.Socket} tcpSocket
 * @constructor
 */
function Ping(events, tcpSocket) {
    this._events = events;
    this._tcpSocket = tcpSocket;

    this._alive = true;
    this._timeout = null;

    this
        ._setTimeout()
        ._setHandlers();
}

/**
 * @returns {Ping}
 */
Ping.prototype._doPing = function () {
    if (this._alive) {
        this._events.emit("packs:write", _PACK_NAME);

        return this;
    }

    this._alive = true;
    return this;
};

/**
 * @returns {Ping}
 */
Ping.prototype._setTimeout = function () {
    let timeoutHandler = () => {
        this._alive = false;
        this._events.emit("packs:write", _PACK_NAME);

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
Ping.prototype._refreshTimeout = function () {
    this._timeout.refresh();

    return this;
};

/**
 * @returns {Ping}
 */
Ping.prototype._clearTimeout = function () {
    clearTimeout(this._timeout);

    return this;
};

/**
 * @returns {Ping}
 */
Ping.prototype._setHandlers = function () {
    this._events
        .on(`packs:${_PACK_NAME}`, this._doPing.bind(this));

    this._tcpSocket
        .on("readable", this._refreshTimeout.bind(this))
        .on("close", this._clearTimeout.bind(this));

    return this;
};

module.exports = Ping;