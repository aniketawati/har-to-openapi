import type { Har } from "har-format";
import type { HarToOpenAPIConfig, HarToOpenAPISpec } from "./types";
declare const generateSpecs: <T extends Har>(har: T, config?: HarToOpenAPIConfig, oldSpecs?: HarToOpenAPISpec[]) => Promise<HarToOpenAPISpec[]>;
declare const generateSpec: <T extends Har>(har: T, config?: HarToOpenAPIConfig, oldSpecs?: HarToOpenAPISpec[]) => Promise<HarToOpenAPISpec>;
export { generateSpec, generateSpecs, HarToOpenAPIConfig, HarToOpenAPISpec };
