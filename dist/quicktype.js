"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quicktypeJSON = void 0;
const json_schema_ref_parser_1 = __importDefault(require("@apidevtools/json-schema-ref-parser"));
const quicktype_core_1 = require("quicktype-core");
const lodash_1 = require("lodash");
/**
 * This is a hotfix and really only a partial solution as it does not cover all cases.
 *
 * But it's the best we can do until we find or build a better library to handle references.
 *
 * original source https://github.com/asyncapi/modelina/pull/829/files
 */
const handleRootReference = (input) => {
    //Because of https://github.com/APIDevTools/json-schema-ref-parser/issues/201 the tool cannot handle root references.
    //This really is a bad patch to fix an underlying problem, but until a full library is available, this is best we can do.
    const hasRootRef = input.$ref !== undefined;
    if (hasRootRef) {
        //When we encounter it, manually try to resolve the reference in the definitions section
        const hasDefinitionSection = input.definitions !== undefined;
        if (hasDefinitionSection) {
            const definitionLink = "#/definitions/";
            const referenceLink = input.$ref.slice(0, definitionLink.length);
            const referenceIsLocal = referenceLink === definitionLink;
            if (referenceIsLocal) {
                const definitionName = input.$ref.slice(definitionLink.length);
                const definition = input.definitions[String(definitionName)];
                const definitionExist = definition !== undefined;
                if (definitionExist) {
                    delete input.$ref;
                    return { ...definition, ...input };
                }
            }
        }
    }
    return input;
};
const quicktypeJSON = async (targetLanguage, typeName, sampleArray) => {
    const jsonInput = (0, quicktype_core_1.jsonInputForTargetLanguage)(targetLanguage);
    await jsonInput.addSource({
        name: typeName,
        samples: [sampleArray].flat(),
    });
    const inputData = new quicktype_core_1.InputData();
    inputData.addInput(jsonInput);
    const result = await (0, quicktype_core_1.quicktype)({
        inputData,
        lang: targetLanguage,
        alphabetizeProperties: true,
        allPropertiesOptional: true,
        fixedTopLevels: false,
        ignoreJsonRefs: false,
        combineClasses: false,
    });
    const returnJSON = JSON.parse(result.lines.join("\n"));
    const parser = new json_schema_ref_parser_1.default();
    const derefd = handleRootReference((0, lodash_1.cloneDeep)(returnJSON));
    const dereferenced = await parser.dereference(derefd, {
        dereference: {
            circular: "ignore",
        },
    });
    // if we have circular references we're kinda screwed, i think
    delete dereferenced.definitions;
    return dereferenced;
};
exports.quicktypeJSON = quicktypeJSON;
