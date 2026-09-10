# forms-creator-mcp

An MCP server for building [Defra Forms](https://github.com/DEFRA/forms-designer) form definitions via a conversational AI agent. Describe the form you want and the agent builds the JSON structure step by step.

## Prerequisites

- Node.js 20+
- Claude Code CLI

## Installation

```bash
git clone <this-repo>
cd forms-creator-mcp
npm install
npm run build
```

## Hooking up to Claude Code

### Working inside this repo

Nothing to configure — this repo ships its own `.mcp.json`:

```json
{
  "mcpServers": {
    "forms-creator": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

Run `npm run build` first (`dist/` isn't committed), then start Claude Code from the
repo root and approve the project server when prompted. The path is relative to the
directory Claude Code is launched in, so the repo root matters.

To use the server from *other* projects, pick one of the options below.

### Option A — project scope (shared with the team)

Add a `.mcp.json` file at the root of the project where you want to use this tool,
pointing at your local checkout:

```json
{
  "mcpServers": {
    "forms-creator": {
      "command": "node",
      "args": ["/absolute/path/to/forms-creator-mcp/dist/index.js"]
    }
  }
}
```

Commit this file so everyone on the project gets the server automatically. The path has
to be absolute here, since the server lives outside that project.

### Option B — user scope (available across all your projects)

```bash
claude mcp add --scope user forms-creator -- node /absolute/path/to/forms-creator-mcp/dist/index.js
```

### Option C — local scope (just you, current project only)

```bash
claude mcp add forms-creator -- node /absolute/path/to/forms-creator-mcp/dist/index.js
```

Local scope is the default when no `--scope` flag is given.

### Verify the server is connected

Start Claude Code and run:

```
/mcp
```

You should see `forms-creator` listed with 12 tools.

## Available tools

| Tool | Description |
|---|---|
| `create_form` | Start a new form — resets any in-progress state |
| `add_page` | Add a question page (becomes the active page) |
| `add_guidance_page` | Add an information page with markdown content |
| `add_repeat_page` | Add a repeating page — one question set answered once per item, with an "add another" loop |
| `set_current_page` | Switch the active page by path |
| `add_question` | Add an input field to the active page |
| `add_content` | Add a display-only component (callout, markdown block, bulleted list, etc.) |
| `add_page_condition` | Gate a page so it only shows when a previous answer matches |
| `add_composite_condition` | Combine two or more conditions with AND / OR |
| `apply_condition_to_page` | Apply a composite condition to the active page |
| `get_form_status` | Summary of pages, questions, and conditions built so far |
| `get_form_json` | Full raw JSON of the form being built |
| `save_form` | Write `<form-name>.json` to disk, optionally with a confirmation email on submit |

### Question types for `add_question`

| Type | Description |
|---|---|
| `TextField` | Single-line text |
| `MultilineTextField` | Multi-line textarea |
| `EmailAddressField` | Email with format validation |
| `TelephoneNumberField` | Telephone number |
| `NumberField` | Numeric input (supports `prefix`/`suffix` e.g. `£`, `%`) |
| `YesNoField` | Yes / No radio buttons |
| `DatePartsField` | Day / month / year |
| `MonthYearField` | Month / year only |
| `RadiosField` | Radio buttons from a list (requires `list_items`) |
| `CheckboxesField` | Checkboxes from a list (requires `list_items`) |
| `SelectField` | Dropdown from a list (requires `list_items`) |
| `AutocompleteField` | Autocomplete from a list (requires `list_items`) |
| `UkAddressField` | UK address with postcode lookup. Set `use_postcode_lookup = false` for manual entry |
| `FileUploadField` | File upload |
| `DeclarationField` | Declaration checkbox (requires `content`) |
| `HiddenField` | Value carried through the form without being shown |
| `PaymentField` | GOV.UK Pay charge (requires `amount` and `payment_description`) |
| `GeospatialField` | Draw a point, line or shape on a map |
| `EastingNorthingField` | OS easting and northing coordinate pair |
| `LatLongField` | Latitude and longitude coordinate pair |
| `OsGridRefField` | OS grid reference, e.g. SU 12345 67890 |
| `NationalGridFieldNumberField` | National Grid field number |

### Content types for `add_content`

| Type | Description |
|---|---|
| `Markdown` | Block of Markdown text |
| `Html` | Block of raw HTML |
| `Details` | Collapsible section — `title` is the summary line, `content` the body |
| `InsetText` | Text in a bordered callout |
| `List` | Bulleted or numbered list of fixed text (requires `list_items`) |
| `NotificationBanner` | Banner, optionally styled as a success message |

## Usage

Once Claude Code is connected to the server, describe the form you want in plain English. The agent will call the tools in sequence to build it, then save it to disk.

### Example prompt

```
Using the forms-creator MCP server, build a planning application form with the following pages:

1. "About you" — ask for full name (text), email address, and whether they are the 
   owner of the land (yes/no).

2. "Owner details" — only shown if the previous answer is "No". Ask for the owner's 
   full name and UK address.

3. "Site details" — ask for a description of the proposed works (multiline text, 
   max 500 words) and the date work is due to start (date).

Save the form to /tmp.
```

### How repeating pages work

A repeating page asks the same set of questions once per item, with an "add another" loop and a running list of what the user has added. Use it wherever the source form says "continue on a separate sheet", numbers its blocks (Manufacturer 1, Manufacturer 2), or gives a table with one row per thing — rather than duplicating the questions N times.

```
add_repeat_page(
  title      = "Microchip manufacturer",
  path       = "/manufacturer",
  item_title = "Manufacturer",
  min        = 1,
  max        = 5
)
add_question(type = "TextField", title = "What is the manufacturer name?", name = "manufacturerName")
```

Every question added after the call becomes part of the repeated set, until you call `add_page`, `add_guidance_page`, `add_repeat_page` or `set_current_page` again.

- `item_title` is the singular name for one entry. It labels each item in the "add another" list, so `"Manufacturer"` reads better than `"Manufacturers"` or `"Manufacturer details"`.
- `min` / `max` default to 1 and 25. The schema allows a max of up to 200, but set the bound deliberately to match the form.
- **`FileUploadField` cannot go on a repeating page.** A page holding a file upload uses `FileUploadPageController`, which cannot also repeat — put uploads on their own page. The server rejects this rather than emitting an invalid form.
- Answers to a repeating question are a *set* of values, so a condition testing one behaves differently to a condition on an ordinary question. `add_page_condition` returns a warning when you do this.

This mirrors `RepeatPageController` in the `forms-designer` model package, and the output validates against `formDefinitionV2Schema`.

### How file upload pages work

Adding a `FileUploadField` sets the page controller to `FileUploadPageController` automatically. Without that controller the runtime renders the page as an ordinary one and the upload does not work, so the server sets it rather than leaving it to the caller.

A file upload page can hold **one** `FileUploadField` and nothing else except guidance (`add_content`). The server rejects a second upload on the same page, a question added to a page that already holds an upload, and an upload added to a page that already holds other questions. Give each upload its own page.

### How address questions work

`UkAddressField` uses postcode lookup by default — the user enters a postcode and picks their address from the results. This is quicker and more accurate than typing it out, so it is the right choice for most forms.

Set `use_postcode_lookup = false` to fall back to manual entry, where the user types address line 1, line 2, town, county and postcode. Do this where the address may not be on the postcode file, such as new-build sites and land parcels.

### How payment questions work

`PaymentField` creates a GOV.UK Pay charge. It needs an `amount` in pounds (0 to 100,000) and a `payment_description` of at most 230 characters, which appears on the payment page and the payer's statement.

To vary the charge, pass `conditional_amounts` — a list of condition name and amount pairs, evaluated in order, where the first match wins. The conditions must already exist, so add them before the `PaymentField`. A conditional amount cannot be below £0.30, which is the GOV.UK Pay minimum.

Pass `email_field` with the `name` of an `EmailAddressField` already in the form to prefill the email on the payment page.

### How conditions work

Page conditions gate visibility: a page is only shown to the user if its condition is true. To set one up, add the page and its questions first, then call `add_page_condition` referencing the `name` of a question on a *previous* page.

For **list-based questions** (radios, checkboxes, select), pass the item's `value` string as the condition value.

For **YesNoField**, pass `"true"` / `"yes"` or `"false"` / `"no"`.

For **text or number fields**, pass the string or number value to compare.

To combine conditions (e.g. show a page only when A *and* B are true):
1. Create individual conditions with `add_page_condition` on throwaway pages, or note the names you gave them.
2. Call `add_composite_condition` with those names and a `coordinator` of `"and"` or `"or"`.
3. Call `apply_condition_to_page` on the target page.

### Output

The saved JSON is a valid Defra Forms v2 definition that can be imported directly into the forms designer. A `Check your answers` summary page is appended automatically if not already present. Pass `confirmation_email = true` to `save_form` to have that page use `SummaryPageWithConfirmationEmailController`, which emails the user a confirmation after they submit.

## Skills

The repo ships two agent skills that drive the server for you:

| Skill | What it does |
|---|---|
| `/convert-form` | Converts an existing document form (PDF, Word, ODT, HTML, image scan) into a Defra Forms V2 definition, applying GDS design principles — one thing per page, conditional questions, postcode lookup for UK addresses, repeating pages for repeated answer sets |
| `/update-forms-mcp` | Syncs this server with the latest `forms-designer` schema — diffs the model package against this project's types, state and tools, then adds any new question types, component options, page controllers and condition capabilities |

`/convert-form` takes a filename or path. A bare filename resolves against
`forms_to_convert/`, and the result is saved to `converted_forms/`:

```
/convert-form myForm.docx
```

Both directories are gitignored — create `forms_to_convert/` and drop your source
documents in. `/update-forms-mcp` expects a `forms-designer` checkout at
`../forms-designer`, and will ask for the path if it can't find one.

### Where the skills live

The skills are in `.agents/skills/`, the vendor-neutral [Agent Skills](https://agentskills.io)
convention that Codex, Gemini CLI, Copilot and others read. `.claude/skills` is a
symlink to that directory so the skills also work with Claude Code.

## Development

```bash
# Run directly without building
npm run dev

# Rebuild after changes
npm run build
```
