"use strict";

/**
 * @constructor
 */
function Queue() {
    this._queue = [];
}

/**
 * @param {*} elem
 * @returns {Queue}
 */
Queue.prototype.enqueue = function (elem) {
    this._queue.push(elem);

    return this;
};

/**
 * @returns {*[]}
 */
Queue.prototype.dequeue = function () {
    let queue = this._queue;
    this._queue = [];

    return queue;
};

module.exports = Queue;

