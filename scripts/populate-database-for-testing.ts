import { parseArgs } from "node:util";

const { values } = parseArgs({
    options: {
        depopulate: {
            type: "boolean",
            short: "d",
            default: false,
        },
        populate: {
            type: "boolean",
            short: "p",
            default: false,
        },
    },
});

if (values.populate || values.depopulate) {
    console.log("The V1 testing data loader was removed with the V2 schema cut.");
    console.log("Add a V2 fixture loader against work/library_entry/reading_state before using this script again.");
} else {
    console.log("Pass --populate or --depopulate. V2 fixture loading is not implemented yet.");
}
