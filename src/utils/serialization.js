"use strict";
const _WBUF_LEN = 65535;

const _UTF8 = "utf8";

const _BOOL_TYPE = 10;
const _NUM_TYPE = 20;
const _STR_TYPE = 30;
const _BUF_TYPE = 40;
const _ARR_TYPE = 50;
const _OBJ_TYPE = 60;

const _STR_HEAD_LEN = 2;
const _BUF_HEAD_LEN = 2;
const _ARR_HEAD_LEN = 1;
const _OBJ_HEAD_LEN = 1;
const _OBJ_KEY_HEAD_LEN = 1;

let _index = 0;
let _rBuf = Buffer.alloc(0);
let _wBuf = Buffer.alloc(_WBUF_LEN);

/**
 * @param {Object | Array} obj
 * @param {Boolean} needMainHead
 * @param {...Number} mainHeadLen
 * @returns {Boolean | Buffer}
 */
function serialize(obj, needMainHead, mainHeadLen) {
    _index = needMainHead ? mainHeadLen : 0;

    switch (obj.constructor) {
        case Array:
            _writeArr(obj);
            break;

        case Object:
            _writeObj(obj);
            break;

        default:
            return false;
    }

    let buf = Buffer.alloc(_index);
    _wBuf.copy(buf);

    if (needMainHead) {
        buf.writeUIntLE(buf.length, 0, mainHeadLen);
    }

    return  buf;
}

/**
 * @param {Buffer} buf
 * @param {Boolean} hasMainHead
 * @param {...Number} mainHeadLen
 * @returns {Boolean | Object | Array}
 */
function deserialize(buf, hasMainHead, mainHeadLen) {
    _index = hasMainHead ? mainHeadLen : 0;
    _rBuf = buf;

    let type = _rBuf[_index++];

    switch (type) {
        case _ARR_TYPE:
            return _readArr();

        case _OBJ_TYPE:
            return _readObj();
    }

    return false;
}

/**
 * @param {Boolean} bool
 * @returns {Boolean}
 */
function _writeBool(bool) {
    _wBuf[_index++] = _BOOL_TYPE;
    _wBuf[_index++] = bool ? 1 : 0;

    return true;
}

/**
 * @param {Number} num
 * @returns {Boolean}
 */
function _writeNum(num) {
    _wBuf[_index++] = _NUM_TYPE;

    let numLen = 0;

    if (num > 0) {
        numLen = Math.floor((Math.log2(num) + 1) / 8) + 1;
    } else if (num < 0) {
        numLen = Math.ceil((Math.log2(Math.abs(num)) + 1) / 8);
    } else {
        numLen = 1;
    }

    _wBuf[_index++] = numLen;
    _index = _wBuf.writeIntLE(num, _index, numLen);

    return true;
}

/**
 * @param {String} str
 * @returns {Boolean}
 */
function _writeStr(str) {
    _wBuf[_index++] = _STR_TYPE;

    let strHeadIndex = _index;
    let strLen = _wBuf.write(str, _index += _STR_HEAD_LEN);

    _wBuf.writeUIntLE(strLen, strHeadIndex, _STR_HEAD_LEN);
    _index += strLen;

    return true;
}

/**
 * @param {Buffer} buf
 * @returns {Boolean}
 */
function _writeBuf(buf) {
    _wBuf[_index++] = _BUF_TYPE;

    _index = _wBuf.writeUIntLE(buf.length, _index, _BUF_HEAD_LEN);
    _index += buf.copy(_wBuf, _index);

    return true;
}

/**
 * @param {Array} arr
 * @returns {Boolean}
 */
function _writeArr(arr) {
    _wBuf[_index++] = _ARR_TYPE;

    let arrLen = arr.length;
    _index = _wBuf.writeUIntLE(arrLen, _index, _ARR_HEAD_LEN);

    for (let i = 0; i < arrLen; i++) {
        if (arr[i] === null) {
            continue;
        }

        switch (typeof arr[i]) {
            case "boolean":
                _writeBool(arr[i]);
                break;

            case "number":
                _writeNum(arr[i]);
                break;

            case "string":
                _writeStr(arr[i]);
                break;
        }

        switch (arr[i].constructor) {
            case Buffer:
                _writeBuf(arr[i]);
                break;

            case Array:
                _writeArr(arr[i]);
                break;

            case Object:
                _writeObj(arr[i]);
                break;
        }
    }

    return true;
}

/**
 * @param {Object} obj
 * @returns {Boolean}
 */
function _writeObj(obj) {
    _wBuf[_index++] = _OBJ_TYPE;

    let objHeaderIndex = _index;
    let objLen = 0;

    _index += _OBJ_HEAD_LEN;

    for (let key in obj) {
        if (obj[key] === null) {
            continue;
        }

        let keyHeaderIndex = _index;
        let keyLen = _wBuf.write(key, _index += _OBJ_KEY_HEAD_LEN);

        _wBuf.writeUIntLE(keyLen, keyHeaderIndex, _OBJ_KEY_HEAD_LEN);
        _index += keyLen;

        switch (typeof obj[key]) {
            case "boolean":
                _writeBool(obj[key]);
                break;

            case "number":
                _writeNum(obj[key]);
                break;

            case "string":
                _writeStr(obj[key]);
                break;
        }

        switch (obj[key].constructor) {
            case Buffer:
                _writeBuf(obj[key]);
                break;

            case Array:
                _writeArr(obj[key]);
                break;

            case Object:
                _writeObj(obj[key]);
                break;
        }

        objLen++;
    }

    _wBuf.writeUIntLE(objLen, objHeaderIndex, _OBJ_HEAD_LEN);
    return true;
}

/**
 * @returns {Boolean}
 */
function _readBool() {
    let bool = _rBuf[_index++];

    return !!bool;
}

/**
 * @returns {Number}
 */
function _readNum() {
    let numLen = _rBuf[_index++];
    let num = _rBuf.readIntLE(_index, numLen);

    _index += numLen;
    return num;
}

/**
 * @returns {String}
 */
function _readStr() {
    let strLen = _rBuf.readUIntLE(_index, _STR_HEAD_LEN);
    _index += _STR_HEAD_LEN;

    return _rBuf.toString(_UTF8, _index, _index += strLen);
}

/**
 * @returns {Buffer}
 */
function _readBuf() {
    let bufLen = _rBuf.readUIntLE(_index, _BUF_HEAD_LEN);
    _index += _BUF_HEAD_LEN;

    return _rBuf.slice(_index, _index += bufLen);
}

/**
 * @returns {Array}
 */
function _readArr() {
    let arrLen = _rBuf.readUIntLE(_index, _ARR_HEAD_LEN);
    let arr = [];

    _index += _ARR_HEAD_LEN;

    for (let i = 0; i < arrLen; i++) {
        let type = _rBuf[_index++];

        switch (type) {
            case _BOOL_TYPE:
                arr.push(_readBool());
                break;

            case _NUM_TYPE:
                arr.push(_readNum());
                break;

            case _STR_TYPE:
                arr.push(_readStr());
                break;

            case _BUF_TYPE:
                arr.push(_readBuf());
                break;

            case _ARR_TYPE:
                arr.push(_readArr());
                break;

            case _OBJ_TYPE:
                arr.push(_readObj());
                break;
        }
    }

    return arr;
}

/**
 * @returns {Object}
 */
function _readObj() {
    let objLen = _rBuf.readUIntLE(_index, _OBJ_HEAD_LEN);
    let obj = {};

    _index += _OBJ_HEAD_LEN;

    for (let i = 0; i < objLen; i++) {
        let keyLen = _rBuf.readUIntLE(_index, _OBJ_KEY_HEAD_LEN);
        _index += _OBJ_KEY_HEAD_LEN;

        let key = _rBuf.toString(_UTF8, _index, _index += keyLen);

        let type = _rBuf[_index++];
        switch (type) {
            case _BOOL_TYPE:
                obj[key] = _readBool();
                break;

            case _NUM_TYPE:
                obj[key] = _readNum();
                break;

            case _STR_TYPE:
                obj[key] = _readStr();
                break;

            case _BUF_TYPE:
                obj[key] = _readBuf();
                break;

            case _ARR_TYPE:
                obj[key] = _readArr();
                break;

            case _OBJ_TYPE:
                obj[key] = _readObj();
                break;
        }
    }

    return obj;
}

module.exports = {serialize, deserialize};