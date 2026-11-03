import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	redactStructuredPii,
	rehydrateAmounts,
	scrubForEgress,
	tokenizeAmounts,
} from "../dist/index.js";

const fixture = JSON.parse(
	readFileSync(new URL("../examples/invoice.json", import.meta.url)),
);
const modelInput =
	"Invoice from [COMPANY_1] to [PERSON_1]. Contact [email]. Total due: [AMOUNT_1] for a workshop.";

test("fictional invoice produces the documented outbound string and separate local maps", () => {
	const result = scrubForEgress(fixture);
	assert.equal(result.blocked, false);
	assert.equal(result.sanitized, modelInput);
	assert.deepEqual(
		result.nameRedactions.map((row) => row.original),
		["Canal Works BV", "Mira Vale"],
	);
	assert.equal(result.amountRedactions[0].numericValue, 4250);
	assert.equal(result.amountRedactions[0].original, "€4,250.00");
});

test("default strict mode withholds residual reference numbers; advisory mode reports them", () => {
	const input = { text: "Unlabelled reference 731942." };
	const strict = scrubForEgress(input);
	assert.equal(strict.blocked, true);
	assert.equal(strict.leaks[0].kind, "large_bare_number");
	const advisory = scrubForEgress(input, false);
	assert.equal(advisory.blocked, false);
	assert.deepEqual(advisory.leaks, strict.leaks);
});

test("email, URL, VAT, company number, phone and IBAN shapes are redacted", () => {
	const examples = [
		["billing@example.test", "[email]"],
		["https://example.test/a", "[url]"],
		["BE0123456789", "[vat]"],
		["0123.456.789", "[ondernemingsnummer]"],
		["+32 456 12 34 56", "[telefoon]"],
		["GB00TEST00000000000001", "[iban]"],
	];
	for (const [input, expected] of examples) {
		assert.equal(redactStructuredPii(input), expected);
		assert.equal(redactStructuredPii(expected), expected);
	}
});

test("accented and decomposed names match without replacing parts of other words", () => {
	const result = scrubForEgress({
		text: "Élodie Noël called Amélie; Mélanie answered.",
		names: [
			{ kind: "person", value: "Élodie Noël".normalize("NFD") },
			{ kind: "person", value: "Amélie" },
			{ kind: "person", value: "élan" },
		],
	});
	assert.equal(
		result.sanitized,
		"[PERSON_1] called [PERSON_2]; Mélanie answered.",
	);
});

test("longer company names match first and repeated mentions keep the same token", () => {
	const result = scrubForEgress({
		text: "Canal Works BV called Canal. Canal Works replied.",
		names: [
			{ kind: "company", value: "Canal" },
			{ kind: "company", value: "Canal Works" },
		],
	});
	assert.equal(
		result.sanitized,
		"[COMPANY_1] called [COMPANY_2]. [COMPANY_1] replied.",
	);
});

test("amounts preserve ordinary text, separator spaces, and literal placeholder labels", () => {
	const text =
		"Rack A0 holds [AMOUNT_1]. Quote €20 today, or 1.400,50 EUR tomorrow.";
	const result = tokenizeAmounts(text);
	assert.equal(
		result.text,
		"Rack A0 holds [AMOUNT_1]. Quote [AMOUNT_2] today, or [AMOUNT_3] tomorrow.",
	);
	assert.equal(rehydrateAmounts(result.text, result.redactions), text);
	assert.equal(result.redactions[1].numericValue, 1400.5);
});

test("contextual numbers use original offsets after prior replacements", () => {
	const text =
		"€123456789012345.00 ".repeat(6) +
		"wages and rent. Revenue was 4 500 last quarter.";
	const result = tokenizeAmounts(text);
	assert.equal(result.redactions.at(-1).original, "4 500");
	assert.equal(rehydrateAmounts(result.text, result.redactions), text);
	assert.equal(
		tokenizeAmounts("FY 2025 revenue was flat.").text,
		"FY 2025 revenue was flat.",
	);
});

test("unknown names remain visible and supplied ones cannot reuse a reserved token", () => {
	const text = "[PERSON_1] asks Mira Vale to help Rowan.";
	const result = scrubForEgress({
		text,
		names: [{ kind: "person", value: "Mira Vale" }],
	});
	assert.equal(result.sanitized, "[PERSON_1] asks [PERSON_2] to help Rowan.");
});

test("a keyed audit digest is stable for the same request and key, and changes with either input", () => {
	const run = (text, key) =>
		scrubForEgress({ text }, true, { auditSecret: key }).auditHash;
	assert.equal(run("demo 1", "local-test-a"), run("demo 1", "local-test-a"));
	assert.notEqual(run("demo 1", "local-test-a"), run("demo 1", "local-test-b"));
	assert.notEqual(run("demo 1", "local-test-a"), run("demo 2", "local-test-a"));
});
