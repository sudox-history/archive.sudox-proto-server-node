"use strict";
const EventEmitter = require("events");
const Handshake = require("./managers/handshake");
const Messaging = require("./managers/messaging");
const Ping = require("./managers/ping");
const TCPDuplexer = require("./tcp/tcp-duplexer");

/**
 * @param {module:net.Socket} tcpSocket
 * @constructor
 * @extends {NodeJS.EventEmitter}
 */
function ProtoSocket(tcpSocket) {
    // Extends EventEmitter
    EventEmitter.call(this);
    this._tcpSocket = tcpSocket;

    let tcpDuplexer = new TCPDuplexer(tcpSocket);

    this._handshake = new Handshake(tcpSocket, tcpDuplexer);
    this._messaging = new Messaging(tcpSocket, tcpDuplexer, this._handshake);

    // noinspection JSUnusedGlobalSymbols
    this._ping = new Ping(tcpSocket, tcpDuplexer);

    this._setHandlers();
}

/**
 * @param {*} message
 * @returns {ProtoSocket}
 */
ProtoSocket.prototype.write = function (...message) {
    this._messaging.write(message);

    return this;
};

/**
 * @returns {ProtoSocket}
 */
ProtoSocket.prototype.close = function () {
    this._tcpSocket.destroy();

    return this;
};

/**
 * @returns {ProtoSocket}
 */
ProtoSocket.prototype._onUpgrade = function () {
    this.emit("upgrade");

    return this;
};

/**
 * @param {*[]} message
 * @returns {ProtoSocket}
 */
ProtoSocket.prototype._onMessage = function (message) {
    this.emit.apply(this, message);

    return this;
};

/**
 * @returns {ProtoSocket}
 */
ProtoSocket.prototype._onClose = function () {
    this.emit("close");

    return this;
};

/**
 * @returns {ProtoSocket}
 */
ProtoSocket.prototype._setHandlers = function () {
    this._handshake
        .once("upgrade", this._onUpgrade.bind(this));

    this._messaging
        .on("message", this._onMessage.bind(this));

    this._tcpSocket
        .on("close", this._onClose.bind(this))

        // Do nothing because we just avoid exception
        .on("error", () => null);

    return this;
};

// Extends EventEmitter
Object.setPrototypeOf(ProtoSocket.prototype, EventEmitter.prototype);

module.exports = ProtoSocket;
