import type { Cookie } from "har-format";
import type { ParameterObject } from "@loopback/openapi-v3-types";
export declare const getTypenameFromPath: (path: string) => string;
export declare const parameterizeUrl: (path: string, minLengthForNumericPath?: number) => {
    path: string;
    parameters: ParameterObject[];
};
export declare const getCookieSecurityName: (cookie: Cookie) => string;
