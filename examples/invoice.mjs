import { readFileSync } from "node:fs";
import { scrubForEgress } from "../dist/index.js";

const invoice = JSON.parse(
	readFileSync(new URL("./invoice.json", import.meta.url), "utf8"),
);
if (process.argv.includes("--blocked")) {
	invoice.text += " Unlabelled reference 731942.";
}
const result = scrubForEgress(invoice);

console.log("FICTIONAL INVOICE");
console.log(invoice.text);
if (result.blocked) {
	console.log("\nMODEL INPUT\nWithheld. " + result.blockedReason);
} else {
	console.log("\nMODEL INPUT");
	console.log(result.sanitized);
}
console.log("\nLOCAL REVIEW");
console.log(
	`${result.nameRedactions.length} name matches, ${result.amountRedactions.length} amount matches, ${result.leaks.length} residual findings.`,
);
console.log("No model was called.");
