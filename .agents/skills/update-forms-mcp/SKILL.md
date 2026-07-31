---
name: update-forms-mcp
description: Bring this MCP server up to date with the latest Defra forms-designer form definition schema. Reads the forms-designer model package, diffs it against this project's types/state/tools, then adds any new question types, component options, page controllers and condition capabilities. Use when asked to "update the forms MCP", "sync with forms-designer", "add the new question types", or after forms-designer has been pulled/updated.
---

# Update forms MCP from forms-designer

This project (`forms-creator-mcp`) emits Defra Forms **V2** form definition JSON. The
authoritative definition of that JSON lives in the `forms-designer` repo's `model`
package. This skill syncs this project to it.

## 1. Locate forms-designer

Try to locate forms designer in the following location:

- `../forms-designer` (relative to this project root)

If it does not exist, stop and ask the user for the path. 

Report the resolved path and its current state before doing anything else:

```bash
git -C <designer> log --oneline -1 && git -C <designer> status --short | head
```

If the checkout is on a feature branch or dirty, say so — the user may want `main`
instead. Ask before checking out a different branch; never stash or discard their work.

## 2. Read the authoritative sources

All paths are relative to the forms-designer root. Read these, in this order:

| File | What to take from it |
|---|---|
| `model/src/components/enums.ts` | `ComponentType` — the full list of question/content types, plus per-type option enums (e.g. `GeospatialFieldOptionsCountryEnum`, `GeospatialFieldGeometryTypesEnum`, `TelephoneNumberFieldOptionsFormatEnum`) |
| `model/src/components/types.ts` | The per-component interfaces — exactly which `options` and `schema` keys each type accepts, and which are optional |
| `model/src/components/component-types.ts` | `ComponentTypes` — the default `options`/`schema`/`list` shape a newly created component of each type must have |
| `model/src/pages/enums.ts` + `page-types.ts` + `controller-types.ts` | `ControllerType` values (Summary, Repeat, FileUpload, Terminal, Status, …) and the page shape |
| `model/src/conditions/enums.ts` + `types.ts` + `condition-operators.ts` | Operator names, condition value types (`Value`, `BooleanValue`, `ListItemRef`, `RelativeDate`, …) and which operators are legal for which component type |
| `model/src/form/form-definition/types.ts` | The top-level `FormDefinition` shape — `engine`, `schema`, `startPage`, `pages`, `conditions`, `lists`, `sections` |
| `model/src/form/form-definition/index.ts` | The Joi validation schema. **This is the ground truth** — if this project emits JSON this schema rejects, the form will not import |

Also skim `model/src/form/form-definition/constants.ts` for any version/engine constants.

## 3. Diff against this project

This project's mirror of that schema lives in three files:

- `src/types.ts` — TypeScript mirrors of the designer types (`InputComponentType`,
  `ContentComponentType`, `OperatorName`, `Component`, `Page`, `Condition`,
  `FormDefinition`, `LIST_COMPONENT_TYPES`)
- `src/state.ts` — `FormState`, which builds the JSON. The `switch (params.type)` in
  `addQuestion` is where per-type `options`/`schema` are populated
- `src/index.ts` — the MCP tool definitions and their Zod input schemas

Produce a written diff before editing anything. Cover:

1. **New component types** in the designer that this project has no case for
2. **Removed or renamed** component types
3. **New options/schema keys** on types this project already supports
4. **New page controllers** (e.g. repeat, terminal, status pages)
5. **New condition operators or value types**
6. **Changes to the top-level definition** (engine version, schema number, new arrays)

Present this diff to the user as a short table and confirm the scope before editing —
they may want only a subset. If nothing has changed, say so and stop.

## 4. Apply the updates

Work in this order so each layer compiles on the one below:

1. `src/types.ts` — add the new type names to the unions, add any new interfaces, extend
   `OperatorName`, update `LIST_COMPONENT_TYPES` if a new list-backed type appeared
2. `src/state.ts` — add a `case` to the `addQuestion` switch for each new type, mapping
   the tool params to the exact `options`/`schema` keys the designer expects. Extend
   `AddQuestionParams` with the new parameters. If a new type needs a page controller
   (e.g. file upload, repeat), set it on the page
3. `src/index.ts` — extend the `add_question` Zod schema with the new parameters, add
   any new tools, and keep the tool descriptions accurate about when to use each type
4. `README.md` — update the question type table and the tool table

Follow the existing code style: explicit types, no `var`, braces on every `if`, one
concern per case. Match the surrounding formatting rather than reformatting files.

### Rules that must hold

- Every component gets a `randomUUID()` `id`; list items and list definitions too
- List-backed components reference the list by its **`id`**, and the list is pushed to
  `form.lists`
- Only set an `options`/`schema` key when the caller actually supplied a value — never
  emit `undefined` or a speculative default that the designer doesn't have
- Conditions reference components by `componentId` (the UUID), not by name
- A `/summary` page with `SummaryPageController` is appended on save if absent

## 5. Verify

```bash
npm run build
```

The build must pass with no errors. Then smoke-test end to end: build a small throwaway
form that exercises **each newly added type**, save it to the scratchpad directory, and
inspect the JSON.

If forms-designer's Joi schema is importable, validate the output against it directly —
that is the strongest check available:

```bash
node -e "import('<designer>/model/dist/module/index.js').then(m => { const d = JSON.parse(require('fs').readFileSync('<form>.json','utf8')); const r = m.formDefinitionV2Schema.validate(d, {abortEarly:false}); console.log(r.error?.message ?? 'VALID') })"
```

If the model package isn't built, either build it (`npm --prefix <designer> run build`
in the model workspace) or fall back to a careful manual comparison against
`model/src/form/form-definition/index.ts`. Say which check you actually ran — don't
claim validation you didn't perform.

## 6. Report

Summarise: designer commit synced from, types added, options added, tools changed, what
was verified and how. Call out anything you deliberately left out and why.

Do not commit unless the user asks.
