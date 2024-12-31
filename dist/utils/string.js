"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCookieSecurityName = exports.parameterizeUrl = exports.getTypenameFromPath = void 0;
const lodash_1 = require("lodash");
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateRegex = /(((20[012]\d|19\d\d)|(1\d|2[0123]))-((0[0-9])|(1[012]))-((0[1-9])|([12][0-9])|(3[01])))|(((0[1-9])|([12][0-9])|(3[01]))-((0[0-9])|(1[012]))-((20[012]\d|19\d\d)|(1\d|2[0123])))|(((20[012]\d|19\d\d)|(1\d|2[0123]))\/((0[0-9])|(1[012]))\/((0[1-9])|([12][0-9])|(3[01])))|(((0[0-9])|(1[012]))\/((0[1-9])|([12][0-9])|(3[01]))\/((20[012]\d|19\d\d)|(1\d|2[0123])))|(((0[1-9])|([12][0-9])|(3[01]))\/((0[0-9])|(1[012]))\/((20[012]\d|19\d\d)|(1\d|2[0123])))|(((0[1-9])|([12][0-9])|(3[01]))\.((0[0-9])|(1[012]))\.((20[012]\d|19\d\d)|(1\d|2[0123])))|(((20[012]\d|19\d\d)|(1\d|2[0123]))\.((0[0-9])|(1[012]))\.((0[1-9])|([12][0-9])|(3[01])))/;
const getTypenameFromPath = (path) => {
    const parts = path.split(/[/|${|-}]/g);
    const partsToKeep = [];
    for (const part of parts) {
        // if its blank, skip
        if (!part.length) {
            continue;
        }
        // if its a UUID, skip it
        if (uuidRegex.test(part)) {
            partsToKeep.push("By UUID");
            continue;
        }
        if (part.length > 3 && !isNaN(Number(part))) {
            partsToKeep.push("By ID");
            continue;
        }
        if (dateRegex.test(part)) {
            partsToKeep.push("By Date");
            continue;
        }
        if (part === "true" || part === "false") {
            partsToKeep.push(`set${(0, lodash_1.startCase)(part)}`);
            continue;
        }
        partsToKeep.push(part);
    }
    // kind of heuristics, but we want to filter out things that are like uuids or just numbers
    return (0, lodash_1.uniq)(partsToKeep).join(" ");
};
exports.getTypenameFromPath = getTypenameFromPath;
const parameterizeUrl = (path, minLengthForNumericPath = 3) => {
    const parts = path.split(/[/|${|-}]/g);
    const parameterizedParts = [];
    const parameters = [];
    const addParameter = (id, part, type = "string", extraSchemaParts) => {
        const prefix = id;
        const count = parameters.filter((p) => p.name.startsWith(prefix)).length;
        const suffix = count > 0 ? `${count}` : "";
        const name = `${prefix}${suffix}`;
        parameters.push({
            in: "path",
            name,
            required: true,
            schema: { type, default: part, ...extraSchemaParts },
            example: part,
        });
        parameterizedParts.push(`{${name}}`);
    };
    for (const part of parts) {
        // if its blank, skip
        if (!part.length) {
            continue;
        }
        // if its a UUID, skip it
        if (uuidRegex.test(part)) {
            addParameter("uuid", part, "string", {
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                minLength: 36,
                maxLength: 36,
            });
            continue;
        }
        if (dateRegex.test(part)) {
            addParameter("date", part, "string", { format: "date" });
            continue;
        }
        // if its a number and greater than 3 digits, probably safe to skip?
        if (part.length > minLengthForNumericPath && !isNaN(Number(part))) {
            addParameter("id", part, "integer");
            continue;
        }
        if (part === "true" || part === "false") {
            addParameter("bool", part, "boolean");
            continue;
        }
        parameterizedParts.push(part);
    }
    // kind of heuristics, but we want to filter out things that are like uuids or just numbers
    return { path: "/" + parameterizedParts.join("/"), parameters };
};
exports.parameterizeUrl = parameterizeUrl;
const getCookieSecurityName = (cookie) => {
    const onlyAlphaNumeric = cookie.name.replace(/_/g, " ").replace(/[^a-zA-Z0-9 ]/g, "");
    return (0, lodash_1.camelCase)(`cookie ${onlyAlphaNumeric}`);
};
exports.getCookieSecurityName = getCookieSecurityName;
