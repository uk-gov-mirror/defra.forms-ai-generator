#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FormState } from "./state.js";
import {
  DEFAULT_REPEAT_MAX,
  DEFAULT_REPEAT_MIN,
  MAX_NUMBER_OF_REPEAT_ITEMS,
  MIN_NUMBER_OF_REPEAT_ITEMS,
} from "./types.js";

const state = new FormState();

const server = new McpServer({
  name: "forms-creator",
  version: "1.0.0",
});

const INPUT_COMPONENT_TYPES = [
  "TextField",
  "MultilineTextField",
  "EmailAddressField",
  "TelephoneNumberField",
  "NumberField",
  "YesNoField",
  "DatePartsField",
  "MonthYearField",
  "RadiosField",
  "CheckboxesField",
  "SelectField",
  "AutocompleteField",
  "UkAddressField",
  "FileUploadField",
  "DeclarationField",
  "EastingNorthingField",
  "OsGridRefField",
  "NationalGridFieldNumberField",
  "LatLongField",
  "HiddenField",
  "PaymentField",
  "GeospatialField",
] as const;

const CONTENT_COMPONENT_TYPES = [
  "Markdown",
  "Html",
  "Details",
  "InsetText",
  "List",
  "NotificationBanner",
] as const;

const GEOSPATIAL_COUNTRIES = [
  "england",
  "northern-ireland",
  "scotland",
  "wales",
] as const;

const GEOSPATIAL_GEOMETRY_TYPES = ["point", "line", "shape"] as const;

const OPERATORS = [
  "is",
  "is not",
  "is longer than",
  "is shorter than",
  "has length",
  "contains",
  "does not contain",
  "is at least",
  "is at most",
  "is less than",
  "is more than",
  "is before",
  "is after",
] as const;

function toolResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

server.tool(
  "create_form",
  "Creates a new empty form. Resets any existing in-progress form state.",
  { name: z.string().describe("The form name/title") },
  async ({ name }) => {
    try {
      state.createForm(name);
      return toolResult(`Form "${name}" created. Use add_page to start adding pages.`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "add_page",
  "Adds a question page to the current form. This page becomes the active page for adding questions.",
  {
    title: z.string().describe("Page heading shown to the user"),
    path: z.string().describe("URL path for the page, e.g. /applicant-details"),
  },
  async ({ title, path }) => {
    try {
      state.addPage(title, path);
      return toolResult(`Page "${title}" added at "${path}". Use add_question to add questions to it.`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "add_guidance_page",
  "Adds a guidance or information page with markdown content. Use for instructional pages that display text without collecting answers.",
  {
    title: z.string().describe("Page heading"),
    path: z.string().describe("URL path, e.g. /guidance"),
    content: z.string().describe("Markdown content to display on the page"),
  },
  async ({ title, path, content }) => {
    try {
      state.addGuidancePage(title, path, content);
      return toolResult(`Guidance page "${title}" added at "${path}".`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "add_repeat_page",
  `Adds a repeating question page — one set of questions the user answers once per item, with an "add another" loop and a list of what they have added so far.

Use this for anything the source form handles with "continue on a separate sheet", numbered blocks (Person 1, Person 2, Person 3), a table with one row per thing, or "list all …". It replaces duplicating the same questions N times.

Every question added to this page afterwards becomes part of the repeated set. FileUploadField cannot be used on a repeating page — put uploads on their own page.`,
  {
    title: z.string().describe("Page heading shown to the user, e.g. 'Microchip manufacturer'"),
    path: z.string().describe("URL path for the page, e.g. /manufacturer"),
    item_title: z
      .string()
      .describe(
        "Singular name for one item in the set, shown per entry and on the 'add another' summary, e.g. 'Manufacturer'"
      ),
    min: z
      .number()
      .int()
      .optional()
      .describe(
        `Minimum number of items the user must add (default ${DEFAULT_REPEAT_MIN}, lowest allowed ${MIN_NUMBER_OF_REPEAT_ITEMS})`
      ),
    max: z
      .number()
      .int()
      .optional()
      .describe(
        `Maximum number of items the user may add (default ${DEFAULT_REPEAT_MAX}, highest allowed ${MAX_NUMBER_OF_REPEAT_ITEMS}). Set this deliberately to match the form.`
      ),
  },
  async ({ title, path, item_title, min, max }) => {
    try {
      state.addRepeatPage({ title, path, itemTitle: item_title, min, max });
      const bounds = `${min ?? DEFAULT_REPEAT_MIN} to ${max ?? DEFAULT_REPEAT_MAX}`;
      return toolResult(
        `Repeating page "${title}" added at "${path}". The user can add ${bounds} "${item_title}" entries. Questions added now become part of the repeated set.`
      );
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "set_current_page",
  "Switches the active page. Use this to go back and add questions to an earlier page.",
  {
    path: z.string().describe("Path of the page to make active, e.g. /applicant-details"),
  },
  async ({ path }) => {
    try {
      state.setCurrentPage(path);
      return toolResult(`Current page set to "${path}".`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "add_question",
  `Adds an input question to the current page.

Question types:
- TextField: single-line text
- MultilineTextField: multi-line textarea
- EmailAddressField: email input with format validation
- TelephoneNumberField: telephone input
- NumberField: numeric input (supports prefix/suffix like £ or %)
- YesNoField: yes/no radio buttons
- DatePartsField: day/month/year date input
- MonthYearField: month/year only
- RadiosField: radio buttons from a list (requires list_items)
- CheckboxesField: checkboxes from a list (requires list_items)
- SelectField: dropdown from a list (requires list_items)
- AutocompleteField: autocomplete input from a list (requires list_items)
- UkAddressField: UK address. The user searches by postcode and picks their address; set use_postcode_lookup to false for manual entry
- FileUploadField: file upload input
- DeclarationField: declaration checkbox (requires content)
- HiddenField: value carried through the form without being shown to the user
- PaymentField: GOV.UK Pay charge (requires amount and payment_description)
- GeospatialField: draw a point, line or shape on a map
- EastingNorthingField: OS easting and northing coordinate pair
- LatLongField: latitude and longitude coordinate pair
- OsGridRefField: OS grid reference, e.g. SU 12345 67890
- NationalGridFieldNumberField: National Grid field number`,
  {
    type: z.enum(INPUT_COMPONENT_TYPES).describe("Question type"),
    title: z.string().describe("Question label shown to the user"),
    name: z
      .string()
      .regex(/^[a-zA-Z]+$/, "Component name must contain only letters (a–z, A–Z) — no digits, hyphens or underscores. Use camelCase, e.g. 'applicantName' not 'applicant1Name'.")
      .describe("Unique camelCase field identifier, letters only — no digits or symbols. Used for conditions and summaries, e.g. 'applicantName'"),
    hint: z.string().optional().describe("Optional help text shown below the label"),
    required: z.boolean().optional().describe("Whether the field is required (default: true)"),
    short_description: z
      .string()
      .optional()
      .describe("Short label used in the check-your-answers summary page"),
    list_items: z
      .array(
        z.object({
          text: z.string().describe("Display text for the item"),
          value: z.string().describe("Stored value when selected"),
          hint: z.string().optional().describe("Optional hint text under the item"),
        })
      )
      .optional()
      .describe("Items for RadiosField, CheckboxesField, SelectField, AutocompleteField"),
    max_length: z.number().optional().describe("Max character length (TextField, MultilineTextField)"),
    min_length: z.number().optional().describe("Min character length (TextField, MultilineTextField)"),
    regex: z.string().optional().describe("Regex validation pattern"),
    rows: z.number().optional().describe("Textarea rows (MultilineTextField)"),
    max_words: z.number().optional().describe("Max word count (MultilineTextField)"),
    min_value: z.number().optional().describe("Minimum numeric value (NumberField)"),
    max_value: z.number().optional().describe("Maximum numeric value (NumberField)"),
    prefix: z.string().optional().describe("Unit prefix e.g. £ (NumberField)"),
    suffix: z.string().optional().describe("Unit suffix e.g. kg (NumberField)"),
    max_days_in_past: z
      .number()
      .optional()
      .describe("Max days in the past allowed (DatePartsField)"),
    max_days_in_future: z
      .number()
      .optional()
      .describe("Max days in the future allowed (DatePartsField)"),
    earliest_date: z
      .string()
      .optional()
      .describe("Earliest date allowed, YYYY-MM-DD (DatePartsField)"),
    latest_date: z
      .string()
      .optional()
      .describe("Latest date allowed, YYYY-MM-DD (DatePartsField)"),
    earliest_month_year: z
      .string()
      .optional()
      .describe("Earliest month allowed, YYYY-MM (MonthYearField)"),
    latest_month_year: z
      .string()
      .optional()
      .describe("Latest month allowed, YYYY-MM (MonthYearField)"),
    precision: z.number().optional().describe("Decimal places allowed (NumberField)"),
    min_precision: z.number().optional().describe("Minimum decimal places (NumberField)"),
    content: z.string().optional().describe("Checkbox label text (DeclarationField)"),
    use_postcode_lookup: z
      .boolean()
      .optional()
      .describe(
        "Whether the user finds their address by postcode search (UkAddressField). Defaults to true. Set false for manual entry where the address may not be on the postcode file, such as land parcels or new builds"
      ),
    hide_title: z
      .boolean()
      .optional()
      .describe("Hide the question title, for when the page heading already says it (UkAddressField)"),
    bold: z
      .boolean()
      .optional()
      .describe("Show option labels in bold (RadiosField, CheckboxesField)"),
    telephone_format: z
      .enum(["uk", "international"])
      .optional()
      .describe("Number format to validate against (TelephoneNumberField)"),
    accept: z
      .string()
      .optional()
      .describe(
        "Comma-separated MIME types the upload accepts, e.g. 'application/pdf,image/jpeg' (FileUploadField)"
      ),
    min_files: z.number().optional().describe("Minimum number of files (FileUploadField)"),
    max_files: z.number().optional().describe("Maximum number of files (FileUploadField)"),
    declaration_confirmation_label: z
      .string()
      .optional()
      .describe("Label shown beside the confirmation checkbox (DeclarationField)"),
    min_selected: z.number().optional().describe("Minimum options selected (CheckboxesField)"),
    max_selected: z.number().optional().describe("Maximum options selected (CheckboxesField)"),
    amount: z
      .number()
      .optional()
      .describe("Charge in pounds, 0 to 100000 (PaymentField, required)"),
    payment_description: z
      .string()
      .optional()
      .describe(
        "Text shown on the GOV.UK Pay page and the payer's statement, max 230 characters (PaymentField, required)"
      ),
    conditional_amounts: z
      .array(
        z.object({
          condition: z.string().describe("Display name of an existing condition"),
          amount: z.number().describe("Charge in pounds when the condition is met, minimum 0.30"),
        })
      )
      .optional()
      .describe(
        "Charges that replace the base amount when a condition is met, evaluated in order (PaymentField). Add the conditions first"
      ),
    email_field: z
      .string()
      .optional()
      .describe(
        "Name of an EmailAddressField already in the form, used to prefill the GOV.UK Pay email (PaymentField)"
      ),
    countries: z
      .array(z.enum(GEOSPATIAL_COUNTRIES))
      .optional()
      .describe("Restrict the map to these countries (GeospatialField, EastingNorthingField)"),
    geometry_types: z
      .array(z.enum(GEOSPATIAL_GEOMETRY_TYPES))
      .optional()
      .describe("Shapes the user may draw (GeospatialField)"),
    map_layers: z
      .object({
        sssi: z.boolean().optional().describe("Show Sites of Special Scientific Interest"),
      })
      .optional()
      .describe(
        "Extra map layers to display (GeospatialField, EastingNorthingField, LatLongField, OsGridRefField)"
      ),
    min_features: z.number().optional().describe("Minimum shapes drawn (GeospatialField)"),
    max_features: z.number().optional().describe("Maximum shapes drawn (GeospatialField)"),
    min_easting: z.number().optional().describe("Minimum easting (EastingNorthingField)"),
    max_easting: z.number().optional().describe("Maximum easting (EastingNorthingField)"),
    min_northing: z.number().optional().describe("Minimum northing (EastingNorthingField)"),
    max_northing: z.number().optional().describe("Maximum northing (EastingNorthingField)"),
    min_latitude: z.number().optional().describe("Minimum latitude (LatLongField)"),
    max_latitude: z.number().optional().describe("Maximum latitude (LatLongField)"),
    min_longitude: z.number().optional().describe("Minimum longitude (LatLongField)"),
    max_longitude: z.number().optional().describe("Maximum longitude (LatLongField)"),
    error_description: z
      .string()
      .optional()
      .describe("Wording used for this field inside error messages"),
    autocomplete: z
      .string()
      .optional()
      .describe("HTML autocomplete attribute, e.g. 'given-name', so browsers can prefill"),
    classes: z.string().optional().describe("Extra CSS classes applied to the field"),
    optional_text: z
      .boolean()
      .optional()
      .describe("Show or hide the '(optional)' suffix on an optional field"),
    instruction_text: z.string().optional().describe("Instruction text shown with the field"),
    custom_validation_message: z
      .string()
      .optional()
      .describe("Replaces the default error message shown when validation fails"),
  },
  async (params) => {
    try {
      state.addQuestion({
        type: params.type,
        title: params.title,
        name: params.name,
        hint: params.hint,
        required: params.required,
        shortDescription: params.short_description,
        listItems: params.list_items,
        maxLength: params.max_length,
        minLength: params.min_length,
        regex: params.regex,
        rows: params.rows,
        maxWords: params.max_words,
        minValue: params.min_value,
        maxValue: params.max_value,
        prefix: params.prefix,
        suffix: params.suffix,
        maxDaysInPast: params.max_days_in_past,
        maxDaysInFuture: params.max_days_in_future,
        earliestDate: params.earliest_date,
        latestDate: params.latest_date,
        earliestMonthYear: params.earliest_month_year,
        latestMonthYear: params.latest_month_year,
        precision: params.precision,
        minPrecision: params.min_precision,
        content: params.content,
        usePostcodeLookup: params.use_postcode_lookup,
        hideTitle: params.hide_title,
        bold: params.bold,
        telephoneFormat: params.telephone_format,
        accept: params.accept,
        minFiles: params.min_files,
        maxFiles: params.max_files,
        declarationConfirmationLabel: params.declaration_confirmation_label,
        minSelected: params.min_selected,
        maxSelected: params.max_selected,
        amount: params.amount,
        paymentDescription: params.payment_description,
        conditionalAmounts: params.conditional_amounts,
        emailField: params.email_field,
        countries: params.countries,
        geometryTypes: params.geometry_types,
        mapLayers: params.map_layers,
        minFeatures: params.min_features,
        maxFeatures: params.max_features,
        minEasting: params.min_easting,
        maxEasting: params.max_easting,
        minNorthing: params.min_northing,
        maxNorthing: params.max_northing,
        minLatitude: params.min_latitude,
        maxLatitude: params.max_latitude,
        minLongitude: params.min_longitude,
        maxLongitude: params.max_longitude,
        errorDescription: params.error_description,
        autocomplete: params.autocomplete,
        classes: params.classes,
        optionalText: params.optional_text,
        instructionText: params.instruction_text,
        customValidationMessage: params.custom_validation_message,
      });
      return toolResult(`Question "${params.title}" (${params.type}, name: "${params.name}") added to current page.`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "add_content",
  `Adds a content-only component to the current page (no user input). Use for inline guidance, callouts, or additional information within a question page.

Content types:
- Markdown: a block of Markdown text
- Html: a block of raw HTML
- Details: collapsible section, with title as the summary line and content as the body
- InsetText: text in a bordered callout
- List: a bulleted or numbered list of fixed text (requires list_items)
- NotificationBanner: a banner, optionally styled as a success message`,
  {
    type: z.enum(CONTENT_COMPONENT_TYPES).describe("Content component type"),
    content: z
      .string()
      .optional()
      .describe(
        "Content text, Markdown or HTML depending on type. Required for every type except List"
      ),
    title: z
      .string()
      .optional()
      .describe("Summary line for Details, or the heading above a List"),
    hint: z.string().optional().describe("Optional hint text shown below the title"),
    list_items: z
      .array(
        z.object({
          text: z.string().describe("Text of the list item"),
          value: z.string().describe("Stored value for the item"),
          hint: z.string().optional().describe("Optional hint text under the item"),
        })
      )
      .optional()
      .describe("Items to display (List)"),
    list_type: z
      .enum(["bulleted", "numbered"])
      .optional()
      .describe("How the list is marked up (List)"),
    classes: z.string().optional().describe("Extra CSS classes applied to the component"),
    hide_title: z.boolean().optional().describe("Hide the title above the list (List)"),
    bold: z.boolean().optional().describe("Show the list items in bold (List)"),
    success: z
      .boolean()
      .optional()
      .describe("Style the banner as a success message (NotificationBanner)"),
    heading: z.string().optional().describe("Banner heading (NotificationBanner)"),
  },
  async (params) => {
    try {
      state.addContent({
        type: params.type,
        content: params.content,
        title: params.title,
        hint: params.hint,
        listItems: params.list_items,
        listType: params.list_type,
        classes: params.classes,
        hideTitle: params.hide_title,
        bold: params.bold,
        success: params.success,
        heading: params.heading,
      });
      return toolResult(`${params.type} content component added to current page.`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "add_page_condition",
  `Adds a visibility condition to the current page. The page is only shown to the user if the condition is met.

For list-based questions (RadiosField, CheckboxesField, SelectField, AutocompleteField), pass the item's value string.
For YesNoField, pass "true"/"yes" or "false"/"no".
For NumberField, pass the numeric value as a string.
For text fields, pass the string value to compare.`,
  {
    display_name: z.string().describe("Human-readable name for this condition, e.g. 'Is employed'"),
    component_name: z
      .string()
      .describe("The 'name' field of the question to test, e.g. 'employmentStatus'"),
    operator: z.enum(OPERATORS).describe("Comparison operator"),
    value: z
      .string()
      .describe("Value to compare against. For list fields, use the item's value string."),
  },
  async ({ display_name, component_name, operator, value }) => {
    try {
      const warning = state.addPageCondition({
        displayName: display_name,
        componentName: component_name,
        operator,
        value,
      });
      const message = `Condition "${display_name}" applied to current page. The page will only be shown when ${component_name} ${operator} "${value}".`;
      return toolResult(warning ? `${message}\n\n${warning}` : message);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "add_composite_condition",
  "Creates a new condition that combines two or more existing conditions with AND or OR logic. The resulting condition can then be applied to a page with apply_condition_to_page.",
  {
    display_name: z.string().describe("Name for the composite condition"),
    coordinator: z.enum(["and", "or"]).describe("How to combine the conditions"),
    condition_names: z
      .array(z.string())
      .describe("Display names of the existing conditions to combine"),
  },
  async ({ display_name, coordinator, condition_names }) => {
    try {
      state.addCompositeCondition({
        displayName: display_name,
        coordinator,
        conditionNames: condition_names,
      });
      return toolResult(`Composite condition "${display_name}" created.`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "apply_condition_to_page",
  "Applies an existing named condition to the current page. Use this after add_composite_condition to apply a composite condition to a page.",
  {
    condition_display_name: z
      .string()
      .describe("The display name of the condition to apply (as given to add_page_condition or add_composite_condition)"),
  },
  async ({ condition_display_name }) => {
    try {
      state.applyCompositeConditionToPage(condition_display_name);
      return toolResult(`Condition "${condition_display_name}" applied to current page.`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "save_form",
  "Saves the current form as a JSON file. The filename is derived from the form name in lowercase with hyphens. A summary page is automatically appended if not already present.",
  {
    output_directory: z
      .string()
      .optional()
      .describe("Directory to save the file in (defaults to current working directory)"),
    confirmation_email: z
      .boolean()
      .optional()
      .describe(
        "Send the user a confirmation email after they submit. Only applies when the summary page is being appended automatically"
      ),
  },
  async ({ output_directory, confirmation_email }) => {
    try {
      const filePath = await state.saveForm(output_directory, confirmation_email);
      return toolResult(`Form saved to: ${filePath}`);
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "get_form_status",
  "Returns a summary of the current form: page list, question counts, and applied conditions. Use this to verify progress before continuing.",
  {},
  async () => {
    try {
      return toolResult(JSON.stringify(state.getStatus(), null, 2));
    } catch (err) {
      return toolError(err);
    }
  }
);

server.tool(
  "get_form_json",
  "Returns the full raw JSON of the current form definition. Use this to inspect the complete structure or verify the output before saving.",
  {},
  async () => {
    try {
      return toolResult(JSON.stringify(state.getFormJson(), null, 2));
    } catch (err) {
      return toolError(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
