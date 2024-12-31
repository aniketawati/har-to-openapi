import type { TargetLanguage } from "quicktype-core/dist/TargetLanguage";
import type { JSONSchema } from "@apidevtools/json-schema-ref-parser";
export declare const quicktypeJSON: (targetLanguage: string | TargetLanguage, typeName: string, sampleArray: string | string[]) => Promise<JSONSchema>;
