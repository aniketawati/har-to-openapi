"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSpecs = exports.generateSpec = void 0;
const openapi_v3_types_1 = require("@loopback/openapi-v3-types");
const js_yaml_1 = __importDefault(require("js-yaml"));
const sort_json_1 = __importDefault(require("sort-json"));
const helpers_1 = require("./helpers");
const lodash_1 = require("lodash");
const baseResponse_1 = require("./utils/baseResponse");
const methods_1 = require("./utils/methods");
const headers_1 = require("./utils/headers");
const string_1 = require("./utils/string");
const checkPathFromFilter = async (urlPath, harEntry, filter) => {
    if (typeof filter === "string") {
        return urlPath.includes(filter);
    }
    if (filter instanceof RegExp) {
        return filter.test(urlPath);
    }
    if (typeof filter === "function") {
        return filter(urlPath, harEntry);
    }
};
const getConfig = (config) => {
    const internalConfig = (0, lodash_1.cloneDeep)(config || {});
    // set up some defaults
    internalConfig.filterStandardHeaders ?? (internalConfig.filterStandardHeaders = true);
    internalConfig.relaxedContentTypeJsonParse ?? (internalConfig.relaxedContentTypeJsonParse = true);
    internalConfig.guessAuthenticationHeaders ?? (internalConfig.guessAuthenticationHeaders = true);
    // default false
    internalConfig.forceAllRequestsInSameSpec ?? (internalConfig.forceAllRequestsInSameSpec = false);
    internalConfig.dropPathsWithoutSuccessfulResponse ?? (internalConfig.dropPathsWithoutSuccessfulResponse = false);
    internalConfig.attemptToParameterizeUrl ?? (internalConfig.attemptToParameterizeUrl = false);
    internalConfig.minLengthForNumericPath ?? (internalConfig.minLengthForNumericPath = 3);
    internalConfig.relaxedMethods ?? (internalConfig.relaxedMethods = false);
    internalConfig.logErrors ?? (internalConfig.logErrors = false);
    if (internalConfig.guessAuthenticationHeaders) {
        internalConfig.securityHeaders ?? (internalConfig.securityHeaders = []);
        internalConfig.securityHeaders.push(...headers_1.DEFAULT_AUTH_HEADERS);
    }
    if (internalConfig.securityHeaders) {
        internalConfig.securityHeaders = Array.from(new Set(internalConfig.securityHeaders.map((l) => l.toLowerCase())));
    }
    return Object.freeze(internalConfig);
};
function tryGetHostname(url, logErrors, fallback) {
    try {
        return new URL(url).hostname;
    }
    catch {
        if (logErrors) {
            console.error(`Error parsing url ${url}`);
        }
    }
    return fallback;
}
const generateSpecs = async (har, config, oldSpecs) => {
    var _a, _b, _c, _d;
    if (!har?.log?.entries?.length) {
        return [];
    }
    // decode base64 now
    har.log.entries.forEach((item) => {
        const response = item.response;
        if (response && response.content?.encoding === "base64") {
            response.content.text = Buffer.from(response.content.text || "", "base64").toString();
            delete response.content.encoding;
        }
    });
    const internalConfig = getConfig(config);
    const { ignoreBodiesForStatusCodes, mimeTypes, securityHeaders, forceAllRequestsInSameSpec, urlFilter, relaxedMethods, logErrors, attemptToParameterizeUrl, minLengthForNumericPath, dropPathsWithoutSuccessfulResponse, pathReplace, } = internalConfig;
    const groupedByHostname = (0, lodash_1.groupBy)(har.log.entries, (entry) => {
        if (forceAllRequestsInSameSpec) {
            return "specs";
        }
        return tryGetHostname(entry.request.url, logErrors);
    });
    const specs = [];
    for (const domain in groupedByHostname) {
        try {
            // loop through har entries
            const spec = oldSpecs?.find((spec) => spec.domain === domain)?.spec || (0, openapi_v3_types_1.createEmptyApiSpec)();
            spec.info.title = "Api Spec";
            spec.info.description = `OpenAPI spec generated from HAR data for ${domain}`;
            const harEntriesForDomain = groupedByHostname[domain];
            const securitySchemas = [];
            const cookies = [];
            const firstUrl = harEntriesForDomain[0].request.url;
            for (const item of harEntriesForDomain) {
                try {
                    const url = item.request.url;
                    if (!url) {
                        continue;
                    }
                    // filter and collapse path urls
                    const urlObj = new URL(url);
                    if (pathReplace) {
                        for (const key in pathReplace) {
                            urlObj.pathname = urlObj.pathname.replace(new RegExp(key, "g"), pathReplace[key]);
                        }
                    }
                    let urlPath = urlObj.pathname;
                    let pathParams = [];
                    if (attemptToParameterizeUrl) {
                        const { path, parameters } = (0, string_1.parameterizeUrl)(urlPath, minLengthForNumericPath);
                        urlPath = path;
                        pathParams = parameters;
                    }
                    const queryParams = urlObj.search;
                    if (urlFilter) {
                        const isValid = await checkPathFromFilter(urlObj.href, item, urlFilter);
                        if (!isValid) {
                            continue;
                        }
                    }
                    const mimeType = item.response?.content?.mimeType;
                    const isValidMimetype = !mimeTypes || (mimeType && mimeTypes.includes(mimeType));
                    if (!isValidMimetype) {
                        continue;
                    }
                    // create method
                    const method = item.request.method.toLowerCase();
                    // if its not standard and we're not in relaxed mode, skip it
                    if (!relaxedMethods && !(0, methods_1.isStandardMethod)(method)) {
                        continue;
                    }
                    // create path if it doesn't exist
                    (_a = spec.paths)[urlPath] ?? (_a[urlPath] = { parameters: pathParams });
                    const path = spec.paths[urlPath];
                    path[method] ?? (path[method] = (0, helpers_1.addMethod)(method, urlObj, internalConfig));
                    const specMethod = path[method];
                    // generate response
                    const status = item.response?.status;
                    if (status) {
                        (_b = specMethod.responses)[status] ?? (_b[status] = (0, baseResponse_1.addResponse)(status, method));
                    }
                    const requestHeaders = item.request.headers;
                    if (securityHeaders?.length && requestHeaders?.length) {
                        const security = (0, helpers_1.getSecurity)(requestHeaders, securityHeaders, item.request.cookies);
                        if (security) {
                            securitySchemas.push(security);
                            if (security.cookie && item.request.cookies?.length) {
                                cookies.push(...item.request.cookies);
                            }
                            specMethod.security = [security];
                        }
                    }
                    // add query string parameters
                    if (item.request.queryString?.length) {
                        (0, helpers_1.addQueryStringParams)(specMethod, item.request.queryString);
                    }
                    if (queryParams) {
                        // try and parse from the url if the har is malformed
                        const queryStrings = [];
                        for (const entry of urlObj.searchParams.entries()) {
                            queryStrings.push({ name: entry[0], value: entry[1] });
                        }
                        (0, helpers_1.addQueryStringParams)(specMethod, queryStrings);
                    }
                    if (requestHeaders?.length) {
                        (0, helpers_1.addRequestHeaders)(specMethod, requestHeaders, internalConfig);
                    }
                    const shouldUseRequestAndResponse = !ignoreBodiesForStatusCodes || !ignoreBodiesForStatusCodes.includes(status);
                    if (shouldUseRequestAndResponse && item.request.postData) {
                        specMethod.examples ?? (specMethod.examples = []);
                        specMethod.requestBody = await (0, helpers_1.getBody)(item.request.postData, { urlPath, method, examples: specMethod.examples }, internalConfig);
                    }
                    if (status && isValidMimetype && shouldUseRequestAndResponse && item.response) {
                        specMethod.responseExamples ?? (specMethod.responseExamples = {});
                        (_c = specMethod.responseExamples)[status] ?? (_c[status] = []);
                        const body = await (0, helpers_1.getResponseBody)(item.response, { urlPath, method, examples: specMethod.responseExamples[status] }, internalConfig);
                        if (body) {
                            specMethod.responses[status] = body;
                        }
                    }
                }
                catch (e) {
                    if (logErrors) {
                        console.error(`Error parsing ${item.request}`);
                        console.error(e);
                    }
                    // error parsing one entry, move on
                }
            }
            if (dropPathsWithoutSuccessfulResponse) {
                for (const [path, entry] of Object.entries(spec.paths)) {
                    const pathKeys = Object.keys(entry);
                    let hadSuccessfulResponse = false;
                    for (const maybeMethod of pathKeys) {
                        if ((0, methods_1.isStandardMethod)(maybeMethod)) {
                            const responses = Object.keys(entry[maybeMethod].responses);
                            for (const maybeStatus of responses) {
                                // check if any of the responses had a valid status (2xx)
                                hadSuccessfulResponse || (hadSuccessfulResponse = String(maybeStatus).startsWith("2"));
                            }
                        }
                    }
                    if (!hadSuccessfulResponse) {
                        delete spec.paths[path];
                    }
                }
            }
            // If there were no valid paths, bail
            if (!Object.keys(spec.paths).length) {
                continue;
            }
            if (securitySchemas.length) {
                spec.components || (spec.components = {});
                (_d = spec.components).securitySchemes ?? (_d.securitySchemes = {});
                if (cookies.length) {
                    cookies.forEach((cookie) => {
                        const schemaName = (0, string_1.getCookieSecurityName)(cookie);
                        spec.components.securitySchemes[schemaName] = {
                            type: "apiKey",
                            name: cookie.name,
                            in: "cookie",
                        };
                    });
                }
                securitySchemas.forEach((schema) => {
                    const schemaName = Object.keys(schema)[0];
                    spec.components.securitySchemes[schemaName] = {
                        type: "apiKey",
                        name: schemaName,
                        in: "header",
                    };
                });
            }
            // remove the examples that we used to build the superset schemas
            for (const path of Object.values(spec.paths)) {
                for (const method of Object.values(path)) {
                    delete method.responseExamples;
                    delete method.examples;
                }
            }
            // sort paths
            spec.paths = (0, sort_json_1.default)(spec.paths, { depth: 200 });
            const labeledDomain = tryGetHostname(firstUrl, logErrors, domain);
            const prefix = firstUrl?.startsWith("https://") ? "https://" : "http://";
            const server = {
                url: `${prefix}${labeledDomain}`,
            };
            spec.servers = [server];
            const yamlSpec = js_yaml_1.default.dump(spec);
            specs.push({ spec, yamlSpec, domain: labeledDomain });
        }
        catch (err) {
            if (logErrors) {
                console.error(`Error creating spec for ${domain}`);
            }
        }
    }
    return specs;
};
exports.generateSpecs = generateSpecs;
const generateSpec = async (har, config, oldSpecs) => {
    const specs = await generateSpecs(har, config, oldSpecs);
    if (specs.length) {
        return specs[0];
    }
    const spec = (0, openapi_v3_types_1.createEmptyApiSpec)();
    spec.info.title = "HarToOpenApi - no valid specs found";
    return { spec, yamlSpec: js_yaml_1.default.dump(spec), domain: undefined };
};
exports.generateSpec = generateSpec;
