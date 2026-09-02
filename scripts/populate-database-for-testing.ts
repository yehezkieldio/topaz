import { parseArgs } from "node:util";

const { values } = parseArgs({
    options: {
        depopulate: {
            default: false,
            short: "d",
            type: "boolean",
        },
        populate: {
            default: false,
            short: "p",
            type: "boolean",
        },
    },
});

if (values.populate || values.depopulate) {
    console.log("The V1 testing data loader was removed with the V2 schema cut.");
    console.log("Add a V2 fixture loader against work/library_entry/reading_state before using this script again.");
} else {
    console.log("Pass --populate or --depopulate. V2 fixture loading is not implemented yet.");
}
