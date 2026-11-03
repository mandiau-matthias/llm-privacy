/** Replace currency-marked, magnitude-marked, and contextual financial amounts with local tokens. */

/** One redaction entry — the tokeniser returns these in match order. */
export interface AmountRedactionEntry {
	/** Token rendered into the sanitised text, e.g. `[AMOUNT_1]`. */
	token: string;
	/** Original substring captured from the input (with surrounding whitespace trimmed). */
	original: string;
	/** Best-effort parsed value in the smallest unit detected. Null when the parser
	 *  couldn't normalise (e.g. malformed "€-..." or a magnitude word we don't
	 *  resolve). Audit-only — callers must not rely on this for billing math. */
	numericValue: number | null;
	/** Detected currency, normalised to ISO code when possible. Null when no
	 *  currency marker was present (bare number in a keyword window). */
	currency: "EUR" | "USD" | "GBP" | "CHF" | null;
}

export interface AmountTokenizationResult {
	/** Input with every detected amount replaced by `[AMOUNT_n]`. */
	text: string;
	/** Ordered redactions. Use each entry’s token to resolve its original value. */
	redactions: AmountRedactionEntry[];
}

const MAGNITUDE_SUFFIXES = "(?:k|K|m|M|b|B|mln|mio|mrd|bn|bln)";
const MAGNITUDE_WORDS_EN = "(?:thousand|million|billion)";
const MAGNITUDE_WORDS_NL = "(?:duizend|miljoen|miljard)";

/**
 * Reusable digit-body matcher. Accepts:
 *
 *   - Thousands-grouped EU/US (`1.400.000` / `1,400,000`) with at least one
 *     three-digit group (the `+` quantifier, not `*`).
 *   - Plain integer of any length (`1400000`, `42`) with optional decimal.
 *
 * Splitting the two alternatives means a bare `1400000` matches the
 * second alternative entirely, instead of being clipped to the first 3
 * digits by a misbehaving `\d{1,3}(?:[.,]\d{3})*` pattern.
 */
const DIGIT_BODY = String.raw`(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;

// NOTE on escaping: `\b` is a word-boundary in a regex but a BACKSPACE
// character in a regular template literal. Every segment that contains
// `\b` (or `\s`, `\d`) must use `String.raw` so the backslash survives
// the template-literal pass and reaches `new RegExp` as a regex meta-char.

// Currency-prefixed: €1.4M, €1,4M, € 1.400.000, EUR 1400000, $1,400,000, USD 320k
const CURRENCY_PREFIXED_RE = new RegExp(
	String.raw`(?:€|\$|£|EUR|USD|GBP|CHF)\s*-?` +
		DIGIT_BODY +
		String.raw`(?:\s*(?:${MAGNITUDE_SUFFIXES}|${MAGNITUDE_WORDS_EN}|${MAGNITUDE_WORDS_NL}))?\b`,
	"gi",
);

// Currency-suffixed: 1.4M €, 1.400.000 EUR, 320k USD
//
// NOTE: no trailing `\b` after the currency alternation — `\b` is a boundary
// between word and non-word characters, but `€` / `£` are NOT word chars, so
// the boundary fails when the next char is also non-word (whitespace, EOL).
// Use a lookahead instead: end-of-string OR a non-word non-currency char.
const CURRENCY_SUFFIXED_RE = new RegExp(
	String.raw`\b-?` +
		DIGIT_BODY +
		String.raw`\s*` +
		`(?:${MAGNITUDE_SUFFIXES}|${MAGNITUDE_WORDS_EN}|${MAGNITUDE_WORDS_NL})?` +
		String.raw`\s*(?:€|\$|£|EUR|USD|GBP|CHF)(?=$|[^\w€$£])`,
	"gi",
);

// Magnitude-only: 1.4M, 320k, "1,4 million", "320 duizend".
const MAGNITUDE_ONLY_RE = new RegExp(
	String.raw`\b-?` +
		DIGIT_BODY +
		String.raw`\s*` +
		String.raw`(?:${MAGNITUDE_SUFFIXES}|${MAGNITUDE_WORDS_EN}|${MAGNITUDE_WORDS_NL})\b`,
	"gi",
);

// Bare integer ≥ 1000 — only when a financial keyword sits within ±40 chars.
// Either thousands-grouped (which implies ≥1000 by construction) or a raw
// ≥4-digit integer.
const BARE_NUMBER_RE =
	/\b-?\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?\b|\b-?\d{4,}(?:[.,]\d+)?\b/g;

/** Words near which a bare number should be treated as a monetary amount. */
const FINANCIAL_KEYWORDS = [
	// EN
	"revenue",
	"turnover",
	"sales",
	"ebitda",
	"ebit",
	"profit",
	"net income",
	"gross",
	"cash",
	"asking",
	"valuation",
	"price",
	"salary",
	"compensation",
	"owner comp",
	"arr",
	"mrr",
	"capex",
	"opex",
	"cogs",
	"sde",
	"enterprise value",
	"equity",
	"debt",
	"loan",
	"payable",
	"receivable",
	"inventory",
	"assets",
	"liabilities",
	"deal",
	"multiple",
	"rev",
	"margin",
	// NL
	"omzet",
	"winst",
	"verlies",
	"salaris",
	"loon",
	"bezoldiging",
	"vraagprijs",
	"waardering",
	"kasstroom",
	"voorraad",
	"activa",
	"passiva",
	"schuld",
	"vordering",
	"bedrijfsresultaat",
	"nettowinst",
	"brutomarge",
	"huur",
	"kost",
	// FR
	"chiffre",
	"bénéfice",
	"salaire",
	"prix",
	"valeur",
	"dette",
];

/** Date-context words: bare 4-digit numbers next to these are NOT amounts. */
const DATE_KEYWORDS = [
	"year",
	"jaar",
	"boekjaar",
	"fy",
	"q1",
	"q2",
	"q3",
	"q4",
	"kwartaal",
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december",
	"januari",
	"februari",
	"maart",
	"mei",
	"juni",
	"juli",
	"augustus",
	"oktober",
	"jan",
	"feb",
	"mar",
	"apr",
	"jun",
	"jul",
	"aug",
	"sep",
	"oct",
	"nov",
	"dec",
	"mrt",
	"okt",
];

const KEYWORD_WINDOW = 40;

function hasKeywordInWindow(
	source: string,
	matchStart: number,
	matchEnd: number,
	keywords: string[],
): boolean {
	const windowStart = Math.max(0, matchStart - KEYWORD_WINDOW);
	const windowEnd = Math.min(source.length, matchEnd + KEYWORD_WINDOW);
	const slice = source.slice(windowStart, windowEnd).toLowerCase();
	return keywords.some((kw) => slice.includes(kw));
}

/** Parse a captured amount substring into a best-effort numeric value.
 *  Returns null when the format is too ambiguous (e.g. "1,234" — could be EU
 *  one-thousand-two-thirty-four or US one-point-two-three-four). We do not
 *  guess in ambiguous cases because the numeric is audit-only; downstream
 *  callers do not bill from it. */
export function parseAmountValue(captured: string): number | null {
	// Strip currency markers + magnitude words/suffixes; multiply at the end.
	let s = captured.trim();
	let multiplier = 1;

	// Currency strip
	s = s.replace(/(?:€|\$|£|EUR|USD|GBP|CHF)/gi, "").trim();

	// Magnitude word/suffix
	const magnitudeMap: Array<[RegExp, number]> = [
		[/\bmiljard\b/i, 1_000_000_000],
		[/\bbillion\b/i, 1_000_000_000],
		[/\bmrd\b/i, 1_000_000_000],
		[/\bbn\b/i, 1_000_000_000],
		[/\bbln\b/i, 1_000_000_000],
		[/\bmiljoen\b/i, 1_000_000],
		[/\bmillion\b/i, 1_000_000],
		[/\bmln\b/i, 1_000_000],
		[/\bmio\b/i, 1_000_000],
		[/\bduizend\b/i, 1_000],
		[/\bthousand\b/i, 1_000],
		// Single-letter suffixes — require the letter to be at the end with no
		// following letter (avoid matching "1m4" identifiers).
		[/\b\d[\d.,\s]*\s*M\b/, 1_000_000],
		[/\b\d[\d.,\s]*\s*m\b/, 1_000_000],
		[/\b\d[\d.,\s]*\s*B\b/, 1_000_000_000],
		[/\b\d[\d.,\s]*\s*b\b/, 1_000_000_000],
		[/\b\d[\d.,\s]*\s*K\b/, 1_000],
		[/\b\d[\d.,\s]*\s*k\b/, 1_000],
	];

	for (const [re, mult] of magnitudeMap) {
		if (re.test(s)) {
			multiplier = mult;
			// Strip the suffix word/letter
			s = s.replace(re, (m) => m.replace(/[A-Za-z]+/g, "")).trim();
			break;
		}
	}

	// Now `s` should be digits + separators. Try both EU and US conventions;
	// commit only when one parses unambiguously.
	s = s.replace(/\s+/g, "");
	const lastDot = s.lastIndexOf(".");
	const lastComma = s.lastIndexOf(",");

	let normalised: string | null = null;
	if (lastDot === -1 && lastComma === -1) {
		normalised = s;
	} else if (lastDot > -1 && lastComma > -1) {
		// Both present — the LATER one is the decimal separator.
		if (lastDot > lastComma) {
			normalised = s.replace(/,/g, ""); // US: 1,400,000.00
		} else {
			normalised = s.replace(/\./g, "").replace(",", "."); // EU: 1.400.000,00
		}
	} else if (lastDot > -1) {
		// Only dots — could be EU thousands (1.400.000) or US decimal (1400.00).
		const after = s.slice(lastDot + 1);
		if (
			after.length === 3 &&
			/^\d{3}$/.test(after) &&
			/\d+\.\d{3}(?:\.\d{3})*$/.test(s)
		) {
			normalised = s.replace(/\./g, ""); // EU thousands
		} else if (after.length <= 2) {
			normalised = s; // US decimal
		} else {
			// Ambiguous (e.g. "1.234"): return null
			return null;
		}
	} else {
		// Only commas — could be EU decimal (1,4) or US thousands (1,400,000).
		const after = s.slice(lastComma + 1);
		if (
			after.length === 3 &&
			/^\d{3}$/.test(after) &&
			/\d+,\d{3}(?:,\d{3})*$/.test(s)
		) {
			normalised = s.replace(/,/g, ""); // US thousands
		} else if (after.length <= 2) {
			normalised = s.replace(",", "."); // EU decimal
		} else {
			return null;
		}
	}

	if (normalised === null) return null;
	const n = Number.parseFloat(normalised);
	if (!Number.isFinite(n)) return null;
	return n * multiplier;
}

function detectCurrency(captured: string): AmountRedactionEntry["currency"] {
	if (/€|EUR/i.test(captured)) return "EUR";
	if (/\$|USD/i.test(captured)) return "USD";
	if (/£|GBP/i.test(captured)) return "GBP";
	if (/CHF/i.test(captured)) return "CHF";
	return null;
}

/**
 * Replace every monetary amount in `input` with `[AMOUNT_n]` tokens. Returns
 * the redacted text + an ordered map of originals.
 *
 * The three passes run in priority order:
 *
 *   1. Currency-marked numbers (`€1.4M`, `EUR 1400000`, `320k €`)
 *   2. Magnitude-suffix-only numbers (`1.4M`, `320k`, `1.4 million`)
 *   3. Bare numbers ≥ 1000 in a financial-keyword window (`revenue 1400000`)
 *
 * Each pass uses placeholder substitution so that later passes don't re-match
 * tokens emitted by earlier passes. Date-context bare numbers are spared in
 * pass 3.
 */
export function tokenizeAmounts(input: string): AmountTokenizationResult {
	if (typeof input !== "string" || input.length === 0) {
		return { text: input ?? "", redactions: [] };
	}

	const redactions: AmountRedactionEntry[] = [];
	const spans: { start: number; end: number; token: string }[] = [];
	const reserved = new Set(input.match(/\[AMOUNT_\d+\]/g) ?? []);
	let nextToken = 1;
	let remaining = input;

	// Mask each selected span at its original length. Later passes must read
	// keyword windows at the same offsets, and ordinary text must survive intact.
	function capture(text: string, start: number): string {
		let token: string;
		do {
			token = `[AMOUNT_${nextToken++}]`;
		} while (reserved.has(token));
		redactions.push({
			token,
			original: text,
			numericValue: parseAmountValue(text),
			currency: detectCurrency(text),
		});
		spans.push({ start, end: start + text.length, token });
		return "\0".repeat(text.length);
	}

	for (const pattern of [
		CURRENCY_PREFIXED_RE,
		CURRENCY_SUFFIXED_RE,
		MAGNITUDE_ONLY_RE,
	]) {
		remaining = remaining.replace(pattern, capture);
	}
	remaining.replace(BARE_NUMBER_RE, (text, start: number) => {
		const value = parseAmountValue(text);
		const end = start + text.length;
		if (value !== null && Math.abs(value) < 1000) return text;
		if (
			value !== null &&
			value >= 1900 &&
			value <= 2100 &&
			hasKeywordInWindow(input, start, end, DATE_KEYWORDS)
		)
			return text;
		if (!hasKeywordInWindow(input, start, end, FINANCIAL_KEYWORDS)) return text;
		return capture(text, start);
	});

	let cursor = 0;
	const parts: string[] = [];
	for (const span of spans.sort((a, b) => a.start - b.start)) {
		parts.push(input.slice(cursor, span.start), span.token);
		cursor = span.end;
	}
	parts.push(input.slice(cursor));
	return { text: parts.join(""), redactions };
}

/**
 * Re-hydrate `[AMOUNT_n]` tokens in a model-generated string using a previously
 * captured redaction map. Defensive — out-of-range tokens are left in place
 * rather than throwing, since the model may have invented tokens that weren't
 * in the input. Returns the rehydrated string.
 *
 * Phase 1 keeps this unused on the response path (we want the model talking in
 * abstract amounts so the user sees its reasoning over `[AMOUNT_1]`); the
 * helper exists so a Phase 2 rehydration UX can opt in per surface.
 */
export function rehydrateAmounts(
	text: string,
	redactions: AmountRedactionEntry[],
): string {
	if (typeof text !== "string" || redactions.length === 0) return text;
	const originals = new Map(
		redactions.map((entry) => [entry.token, entry.original]),
	);
	return text.replace(
		/\[AMOUNT_\d+\]/g,
		(token) => originals.get(token) ?? token,
	);
}
