# LLM Privacy

What would a language model receive if you asked it to explain an invoice? This TypeScript package replaces the names you register, recognized identifiers, and financial amounts before your application sends text to a provider.

**Fictional invoice**

> Invoice from Canal Works BV to Mira Vale. Contact billing@example.test. Total due: €4,250.00 for a workshop.

**Text available to the model**

> Invoice from [COMPANY_1] to [PERSON_1]. Contact [email]. Total due: [AMOUNT_1] for a workshop.

### Run the example

With Node.js 20 or later, run these commands from the repository. The compiled code is included. The example uses no API key, makes no network requests, and never calls a model.

```sh
node examples/invoice.mjs
node examples/invoice.mjs --blocked
```

The second command adds an unlabelled six-digit reference. Strict mode returns a blocked result. The example withholds the entire model input and prints the reason locally. To experiment, edit the [fictional invoice and name list](examples/invoice.json).

### Use it in your app

```sh
npm install https://github.com/mandiau-matthias/llm-privacy/archive/refs/tags/v0.1.0.tar.gz
```

```js
import { scrubForEgress } from "llm-privacy";

const result = scrubForEgress({
  text: "Mira Vale paid €120 to Canal Works BV.",
  names: [
    { kind: "person", value: "Mira Vale" },
    { kind: "company", value: "Canal Works" },
  ],
});
if (result.blocked) throw new Error(result.blockedReason);
const modelInput = result.sanitized;
// [PERSON_1] paid [AMOUNT_1] to [COMPANY_1].
```

Send only `modelInput` if your application chooses to call a provider. The other fields include local token maps containing original values and diagnostic excerpts that may contain sensitive text. Keep them out of model requests and shared logs.

### Coverage

Structured patterns cover emails, URLs, selected European identifiers, phone-number forms, and long digit runs. The amount tokenizer recognizes several currency symbols, magnitude suffixes and numbers near financial terms. Name detection uses the vocabulary you supply. An unregistered name can pass through, and a pattern can also hide ordinary text. Inspect the output on representative examples before using it with real records.

Strict mode is the default. Passing `false` as the second argument returns residual findings in advisory mode. A third argument with `auditSecret` creates a keyed audit digest. Retention settings and the provider call belong to the integrating application.

### Development

Run `npm ci && npm run build && npm test`. The package has no runtime dependencies. I originally built these tools at Upswitch for financial text. The Automatron edition includes regression tests for accented names, number formatting, repeated names, blocked payloads, and token collisions.

A useful first contribution is a failing test with a fictional invoice whose text is handled incorrectly. [MIT license and original credit](LICENSE)
