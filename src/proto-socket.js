"use strict";
const EventEmitter = require("events");
const Handshake = require("./managers/handshake");
const Messaging = require("./managers/messaging");
const Ping = require("./managers/ping");
const TCPDuplexer = require("./net/tcp-duplexer");

/**
 * @param {module:net.Socket} tcpSocket
 * @extends {NodeJS.EventEmitter}
 * @constructor
 */
function ProtoSocket(tcpSocket) {
    this._tcpSocket = tcpSocket;

    this._events = new EventEmitter();

    new Handshake(this._events, tcpSocket);
    new Messaging(this._events, tcpSocket);
    new Ping(this._events, tcpSocket);

    new TCPDuplexer(this._events, tcpSocket);

    this._setHandlers();
}

/**
 * @param {*} message
 * @returns {ProtoSocket}
 */
ProtoSocket.prototype.write = function (...message) {
    this._events.emit("messages:write", message);

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
ProtoSocket.prototype._setHandlers = function () {
    // noinspection JSCheckFunctionSignatures
    this._events
        .on("messages:new", message => this.emit(...message))
        .on("managers:upgrade", () => this.emit("upgrade"));

    this._tcpSocket
        .on("close", () => this.emit("close"))

        // Do nothing because we just avoid exception
        .on("error", () => null);

    return this;
};

// Extends EventEmitter
Object.setPrototypeOf(ProtoSocket.prototype, EventEmitter.prototype);

module.exports = ProtoSocket;
