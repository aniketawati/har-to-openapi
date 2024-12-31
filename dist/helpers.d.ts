import type { InternalConfig } from "./types";
import type { OperationObject, RequestBodyObject, ResponseObject, SecurityRequirementObject } from "@loopback/openapi-v3-types";
import type { Content, Cookie, Header, PostData, QueryString, Response } from "har-format";
export declare const addMethod: (method: string, url: URL, config: InternalConfig) => OperationObject;
export declare const addRequestHeaders: (specMethod: OperationObject, headers: Header[], config: InternalConfig) => void;
export declare const addQueryStringParams: (specMethod: OperationObject, harParams: QueryString[]) => void;
export declare const getSecurity: (headers: Header[], securityHeaders: string[], cookies: Cookie[] | undefined) => SecurityRequirementObject | undefined;
export declare const getBody: (postData: PostData | Content | undefined, details: {
    urlPath: string;
    method: string;
    examples: any[];
}, config: InternalConfig) => Promise<RequestBodyObject | undefined>;
export declare const getResponseBody: (response: Response, details: {
    urlPath: string;
    method: string;
    examples: any[];
}, config: InternalConfig) => Promise<ResponseObject | undefined>;
