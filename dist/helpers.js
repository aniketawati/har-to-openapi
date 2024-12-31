"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResponseBody = exports.getBody = exports.getSecurity = exports.addQueryStringParams = exports.addRequestHeaders = exports.addMethod = void 0;
const json_schema_to_openapi_schema_1 = __importDefault(require("@openapi-contrib/json-schema-to-openapi-schema"));
const quicktype_1 = require("./quicktype");
const lodash_1 = require("lodash");
const headers_1 = require("./utils/headers");
const url_1 = require("url");
const string_1 = require("./utils/string");
const whatwg_mimetype_1 = __importDefault(require("whatwg-mimetype"));
const addMethod = (method, url, config) => {
    const path = url.pathname;
    // generate operation id
    const summary = `${method} ${(0, string_1.getTypenameFromPath)(path)}`;
    const operationId = (0, lodash_1.camelCase)(summary);
    const tags = config?.tags || [];
    let pathTags = [];
    if (typeof tags === "function") {
        const userDefinedTags = tags(path);
        pathTags = [userDefinedTags || []].flat();
    }
    else {
        for (const tag of tags) {
            const isTagArray = Array.isArray(tag);
            const comparison = isTagArray ? tag[0] : tag;
            if (path.includes(comparison)) {
                const tagToApply = isTagArray ? (tag.length === 2 ? tag[1] : tag[0]) : tag;
                pathTags.push(tagToApply);
            }
        }
    }
    const operationsObject = {
        operationId,
        description: "",
        summary: (0, lodash_1.startCase)(summary),
        parameters: [],
        responses: {},
    };
    if (config?.addServersToPaths) {
        const server = {
            url: url.origin,
        };
        operationsObject.servers = [server]; // not perfect but we can try and set the servers property here
    }
    if (pathTags?.length) {
        operationsObject.tags = pathTags;
    }
    return operationsObject;
};
exports.addMethod = addMethod;
const addRequestHeaders = (specMethod, headers, config) => {
    const parameters = (specMethod.parameters ?? (specMethod.parameters = []));
    const { filterStandardHeaders, securityHeaders = [] } = config;
    const customHeaders = filterStandardHeaders
        ? headers.filter((header) => {
            return !(0, headers_1.shouldFilterHeader)(header.name, securityHeaders);
        })
        : headers;
    customHeaders.forEach((header) => {
        parameters.push({
            schema: {
                type: "string",
                default: header.value,
                example: header.value,
            },
            in: "header",
            name: header.name,
            description: header.name,
        });
    });
    specMethod.parameters = (0, lodash_1.uniqBy)(parameters, (elem) => {
        return `${elem.name}:${elem.in}:${elem.$ref}`;
    });
};
exports.addRequestHeaders = addRequestHeaders;
const addQueryStringParams = (specMethod, harParams) => {
    const methodQueryParameters = [];
    const parameters = (specMethod.parameters ?? (specMethod.parameters = []));
    parameters.forEach((param) => {
        if ("in" in param && param.in === "query") {
            methodQueryParameters.push(param.name);
        }
    });
    harParams?.forEach((param) => {
        if (!methodQueryParameters.includes(param.name)) {
            // add query parameter
            parameters.push({
                schema: {
                    type: "string",
                    default: decodeURIComponent(param.value),
                    example: decodeURIComponent(param.value),
                },
                in: "query",
                name: param.name,
                description: param.name,
            });
        }
    });
};
exports.addQueryStringParams = addQueryStringParams;
const getSecurity = (headers, securityHeaders, cookies) => {
    const security = {};
    headers.forEach(function (header) {
        const headerName = header.name.trim().toLowerCase();
        if (securityHeaders.includes(headerName)) {
            security[header.name] = [];
            if (headerName === "cookie" && cookies?.length) {
                cookies.forEach((cookie) => {
                    const securityName = (0, string_1.getCookieSecurityName)(cookie);
                    security["cookie"]?.push(securityName);
                });
            }
        }
    });
    if (Object.keys(security).length === 0) {
        return undefined;
    }
    return security;
};
exports.getSecurity = getSecurity;
const mapParams = (params) => {
    const properties = {};
    const required = params.map((query) => {
        if (query.value == "" || query.value == "(binary)") {
            properties[query.name] = {
                type: "string",
                format: "binary",
            };
            return query.name;
        }
        properties[query.name] = {
            type: "string",
        };
        return query.name;
    });
    const response = {
        type: "object",
        properties,
    };
    if (required.length) {
        response.required = required;
    }
    return response;
};
const getFormData = (postData) => {
    if (postData && "params" in postData && postData?.params?.length && postData.params.length > 0) {
        return mapParams(postData.params);
    }
    if (postData && "text" in postData) {
        const searchParams = new url_1.URLSearchParams(postData.text);
        const params = [];
        searchParams.forEach((value, key) => {
            params.push({ value, name: key });
        });
        return mapParams(params);
    }
};
const isBinaryMimeType = (mimeType) => {
    return (["image", "audio", "video"].includes(mimeType.type) ||
        [
            "octet-stream",
            "x-octet-stream",
            "pdf",
            "png",
            "jpeg",
            "msword",
            "vnd.ms-excel",
            "vnd.ms-powerpoint",
            "zip",
            "rar",
            "x-tar",
            "x-7z-compressed",
        ].includes(mimeType.subtype));
};
const getBody = async (postData, details, config) => {
    if (!postData || !postData.mimeType) {
        return undefined;
    }
    const { urlPath, method, examples } = details;
    const param = {
        required: true,
        content: {},
    };
    const text = postData.text;
    const options = {
        cloneSchema: true,
        dereference: true,
        dereferenceOptions: {
            dereference: {
                circular: "ignore",
            },
        },
    };
    if (postData && text !== undefined) {
        const mimeType = new whatwg_mimetype_1.default(postData.mimeType);
        const mimeEssence = mimeType.essence;
        const mime = mimeType.subtype;
        // do nothing on json parse failures - just take the mime type and say its a string
        const isBase64Encoded = "encoding" in postData && postData.encoding == "base64";
        const isBinary = isBinaryMimeType(mimeType);
        const baseSchemaFallback = { type: "string", format: isBase64Encoded || isBinary ? "binary" : undefined };
        const baseExample = config.includeNonJsonExampleResponses ? text : undefined;
        // first check for binary types
        const tryParseJson = async () => {
            const data = JSON.parse(isBase64Encoded ? Buffer.from(text, "base64").toString() : text);
            examples.push(JSON.stringify(data));
            const typeName = (0, lodash_1.camelCase)([(0, string_1.getTypenameFromPath)(urlPath), method, "request"].join(" "));
            const jsonSchema = await (0, quicktype_1.quicktypeJSON)("schema", typeName, examples);
            const schema = await (0, json_schema_to_openapi_schema_1.default)(jsonSchema, options);
            return { schema, data };
        };
        if (isBinary) {
            if (config.relaxedContentTypeJsonParse) {
                try {
                    const { schema, data } = await tryParseJson();
                    param.content[mimeEssence] = {
                        schema,
                        example: data,
                    };
                    return param;
                }
                catch (err) {
                    // continue
                }
            }
            param.content[mimeEssence] = {
                schema: baseSchemaFallback,
            };
            return param;
        }
        // We run the risk of circular references down below
        const mimeLower = mime.toLocaleLowerCase();
        switch (mimeLower) {
            case "form-data":
            case "x-www-form-urlencoded":
                const formSchema = getFormData(postData);
                if (formSchema) {
                    const schema = await (0, json_schema_to_openapi_schema_1.default)(formSchema, options);
                    if (schema) {
                        param.content[mimeEssence] = {
                            schema,
                        };
                    }
                }
                break;
            case "plain":
            case "text":
            case "json":
            default: {
                if (mimeLower === "json" || config.relaxedContentTypeJsonParse) {
                    try {
                        const { schema, data } = await tryParseJson();
                        param.content[mimeEssence] = {
                            schema,
                            example: data,
                        };
                    }
                    catch (err) {
                        param.content[mimeEssence] = {
                            schema: baseSchemaFallback,
                            example: baseExample,
                        };
                    }
                }
                break;
            }
        }
        if (!param.content[mimeEssence]) {
            param.content[mimeEssence] = {
                schema: baseSchemaFallback,
                example: baseExample,
            };
        }
    }
    else {
        const multipartMimeType = "multipart/form-data";
        // Don't apply the fallback to if there is a filter and it doesn't include it
        if (!config.mimeTypes || config.mimeTypes.includes(multipartMimeType)) {
            param.content = {
                [multipartMimeType]: {
                    schema: {
                        properties: {
                            filename: {
                                description: "",
                                format: "binary",
                                type: "string",
                            },
                        },
                        type: "object",
                    },
                },
            };
        }
    }
    return param;
};
exports.getBody = getBody;
const getResponseBody = async (response, details, config) => {
    const body = await (0, exports.getBody)(response.content, details, config);
    const { filterStandardHeaders, securityHeaders } = config;
    const param = {
        description: "",
    };
    if (body?.content) {
        param.content = body.content;
    }
    const headers = response.headers || [];
    const customHeaders = filterStandardHeaders
        ? headers.filter((header) => {
            return !(0, headers_1.shouldFilterHeader)(header.name, securityHeaders);
        })
        : headers;
    if (customHeaders.length) {
        param.headers = customHeaders.reduce((acc, header) => {
            acc[header.name] = {
                description: `Custom header ${header.name}`,
                schema: {
                    type: "string",
                },
            };
            return acc;
        }, {});
    }
    if (param.headers || param.content) {
        return param;
    }
};
exports.getResponseBody = getResponseBody;
