"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStandardMethod = void 0;
const STANDARD_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const isStandardMethod = (header) => {
    return Boolean(header) && STANDARD_METHODS.includes(header.toLowerCase());
};
exports.isStandardMethod = isStandardMethod;
