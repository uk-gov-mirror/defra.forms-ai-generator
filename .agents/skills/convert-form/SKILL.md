---
name: convert-form
description: Convert an existing document form (PDF, Word, ODT, HTML, image scan) into a Defra Forms V2 JSON definition using the forms-creator MCP server, applying GDS design principles — one thing per page, conditional questions, postcode lookup for UK addresses, map questions for locations, repeating pages for repeated answer sets. Use when asked to "convert a form", "turn this PDF/docx into a Defra form", or given a filename in forms_to_convert/.
---

# Convert a document into a Defra Forms form

## Arguments

`$ARGUMENTS` is a form filename or a full path.

- A bare filename (`NSV-application-form-v2.0.docx`) resolves to
  `forms_to_convert/<filename>` relative to this project root.
- A path containing `/` is used as given.
- If `$ARGUMENTS` is empty, list `forms_to_convert/` and ask which file to convert.

If the resolved file does not exist, list what *is* in `forms_to_convert/` and ask —
don't guess at a near match.

## 1. Extract the document content

Read the whole document. You cannot design a good form from a summary — you need every
question, every option list, and every "if yes, go to question 12" instruction.

| Format | How |
|---|---|
| PDF | The `Read` tool reads PDFs directly (use `pages` for >10 page docs, max 20 per call). Fall back to `pdftotext -layout` if available |
| `.docx` | `textutil -convert txt -stdout <file>` (macOS). If that loses structure, unzip and read `word/document.xml` |
| `.doc` / `.rtf` / `.odt` | `textutil -convert txt -stdout <file>` |
| `.html` / `.md` / `.txt` | `Read` directly |
| Scanned image / image-only PDF | `Read` — describe what you see. If it's illegible, say so and stop |

Write the extracted text to the scratchpad directory so you can re-read it without
re-extracting.

Watch for content that plain text extraction drops: tables of options, checkbox lists,
routing instructions in margins, and continuation sheets. If the extraction looks like
it lost a table, go back and read that part from the original.

## 2. Build a conversion plan

Before calling a single MCP tool, write a plan to the scratchpad and show the user a
condensed version. For every question in the source document record:

- The question text (rewritten to GDS style — see below)
- The component type and why
- Required or optional
- Hint text, if the document has explanatory copy attached to the question
- Option list values, copied verbatim from the document
- Any condition — which earlier answer gates it
- Which page it belongs to

Then list the pages in order, with their paths.

### GDS design principles to apply

**One thing per page.** Default to a single question per page. This is the strongest
GDS convention and the most common thing paper forms get wrong.

**Group only genuinely related questions.** Fields that describe one thing and that a
user holds in their head at once may share a page:

- Title, first name, last name → one "What is your name?" page
- Day/month/year → already one `DatePartsField`, never three questions
- Address lines → already one `UkAddressField`, never separate questions
- A quantity and its unit

Do *not* group merely because the paper form put them in the same box.

**Question wording.** Rewrite paper-form labels as questions addressed to the user:
"Full name of applicant" → "What is your name?". Sentence case. No colons. Put
explanatory text in `hint`, not in the title. Avoid jargon the source uses internally.

**Mark optional questions.** Anything the document flags as optional, or that is only
relevant to some users but has no clean condition, gets `required: false`. The MCP
appends "(optional)" handling via the `required` option. Everything else stays required
— do not mark things optional just because the paper form left them blank-able.

**Conditions instead of "if yes, go to".** Paper forms route with instructions. Turn
every one of these into a page condition on the dependent page, gated on the earlier
question's answer. Never carry the routing instruction across as visible copy.

**Repeating pages** for anything the document handles with "continue on a separate
sheet", numbered blocks (Person 1, Person 2, Person 3), or "list all …". Use a repeat
page with a sensible `min`/`max` rather than N duplicate question sets.

**Guidance pages** where the document has a block of information the user must read
before answering — eligibility notes, what they'll need to hand, declarations context,
privacy notices. Add these as guidance pages with markdown content, placed immediately
before the questions they inform. Don't create a guidance page for a single sentence
that belongs in a hint.

### Component type selection

| In the document | Use |
|---|---|
| UK address | `UkAddressField` — this is the postcode-lookup question. Use it for **any** UK address |
| Non-UK / overseas address | Separate text fields, or a multiline text field. `UkAddressField` is UK-only |
| Map coordinates, grid reference, site location in the UK | The map question type. Check with `get_form_status`/the MCP tool list which geospatial types this build supports (`GeospatialField`, `OsGridRefField`, `EastingNorthingField`, `LatLongField`). If none is available, run the `update-forms-mcp` skill first, or fall back to a text field and tell the user |
| Yes/No tickbox pair | `YesNoField` — not two radios |
| Pick one from a short list (≤ ~7) | `RadiosField` |
| Pick one from a long list | `SelectField`, or `AutocompleteField` if the list is long enough to be worth typing into (countries, species, local authorities) |
| Pick any that apply | `CheckboxesField` |
| Date of birth / event date | `DatePartsField` |
| Month and year only | `MonthYearField` |
| Free text, one line | `TextField` |
| Free text, a paragraph or more | `MultilineTextField` with a sensible `maxWords` |
| Money, counts, area, weight | `NumberField` with `prefix`/`suffix` (`£`, `%`, `ha`) |
| Email, phone | `EmailAddressField`, `TelephoneNumberField` |
| "Attach a copy of…" | `FileUploadField` |
| Signature / "I declare that…" | `DeclarationField` with the declaration text as `content` |

**Copy option lists verbatim.** When the document lists the choices for a dropdown,
radio or checkbox question, transcribe every option exactly as written — do not
paraphrase, reorder, abbreviate, or silently drop ones that look redundant. Use the
document's wording as the item `text`; derive a kebab-case `value` from it. If the
document says "other (please specify)", add the option *and* a conditional follow-up
text question.

## 3. Clarify with the user

Ask before building when a real decision is at stake. Batch the questions into one
round — use `AskUserQuestion` with concrete options rather than prose. Worth asking
about:

- A question that could reasonably be radios vs checkboxes vs free text
- Whether a group of fields should be one page or several
- Whether a repeated block should be a repeating page and what the max is
- An address that might be non-UK
- Sections that look out of scope (office-use-only boxes, internal reference fields) —
  propose dropping them
- Routing that the document states ambiguously

Don't ask about things with an obvious answer. Make the routine calls yourself and note
them in the summary.

## 4. Build the form

Use the **forms-creator MCP tools** — do not hand-write the JSON.

1. `create_form` with a clear form name derived from the document title
2. For each page in order: `add_guidance_page` or `add_page`, then `add_question` for
   each component on it
3. Add conditions **after** the gating question exists:
   - `add_page_condition` for a single condition on the current page
   - `add_composite_condition` + `apply_condition_to_page` for and/or combinations
4. `get_form_status` periodically to confirm the structure is what you intended
5. `save_form` to `converted_forms/` (create the directory if needed)

Naming: give every question a stable, meaningful `name` (kebab or camel, consistent
within the form) — conditions reference questions by name, so throwaway names make the
form unmaintainable. Page `path`s are lowercase kebab-case with a leading slash
(`/your-details`).

Order matters: a page condition can only reference a question on an **earlier** page.
If the document's routing depends on a later answer, the page order needs rethinking —
flag it rather than silently reordering something meaningful.

## 5. Verify and report

Read back the saved JSON and check:

- Every question from the source document is present, or is listed as deliberately
  dropped
- Every option in every list matches the source document
- Every "if… then…" in the source is a condition, and every condition points at a
  question on an earlier page
- Optional questions are marked, required ones are not
- A `/summary` page exists (the MCP appends it)

Then report:

- Where the JSON was saved
- Page-by-page outline (page title → questions → condition, if any)
- Questions dropped or merged, and why
- Anything ambiguous in the source that the user should review
- Anything the source needed that this build of the MCP couldn't express

Do not commit the output unless asked.
