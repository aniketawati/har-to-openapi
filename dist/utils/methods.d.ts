declare const STANDARD_METHODS: readonly ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
type IStandardMethod = typeof STANDARD_METHODS[number];
export declare const isStandardMethod: (header: string) => header is IStandardMethod;
export {};
