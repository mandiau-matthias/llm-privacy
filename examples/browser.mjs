import { scrubText } from "../dist/scrub.js";

const names = document.querySelector("#names");
const reference = document.querySelector("#reference");
const original = document.querySelector("#original");
const output = document.querySelector("#model");
const reason = document.querySelector("#reason");

async function start() {
	const response = await fetch(new URL("./invoice.json", import.meta.url));
	if (!response.ok) throw new Error("Could not load the fictional invoice");
	const invoice = await response.json();
	function render() {
		const text =
			invoice.text + (reference.checked ? " Unlabelled reference 731942." : "");
		const result = scrubText({
			text,
			names: names.checked ? invoice.names : [],
		});
		original.textContent = text;
		output.textContent = result.blocked
			? "Withheld. No text would be sent."
			: result.sanitized;
		reason.textContent = result.blocked
			? result.blockedReason
			: names.checked
				? "The name and amount maps stay local."
				: "Unregistered names remain in the text.";
	}
	names.addEventListener("change", render);
	reference.addEventListener("change", render);
	render();
}

start().catch(() => {
	original.textContent =
		"The fictional invoice could not be loaded. The repository includes the same example.";
	names.disabled = reference.disabled = true;
});
