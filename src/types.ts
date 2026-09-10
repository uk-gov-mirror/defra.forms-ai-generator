export type InputComponentType =
  | "TextField"
  | "MultilineTextField"
  | "EmailAddressField"
  | "TelephoneNumberField"
  | "NumberField"
  | "YesNoField"
  | "DatePartsField"
  | "MonthYearField"
  | "RadiosField"
  | "CheckboxesField"
  | "SelectField"
  | "AutocompleteField"
  | "UkAddressField"
  | "FileUploadField"
  | "DeclarationField"
  | "EastingNorthingField"
  | "OsGridRefField"
  | "NationalGridFieldNumberField"
  | "LatLongField"
  | "HiddenField"
  | "PaymentField"
  | "GeospatialField";

export type ContentComponentType =
  | "Markdown"
  | "Html"
  | "Details"
  | "InsetText"
  | "List"
  | "NotificationBanner";

/**
 * Countries a precise location field may be restricted to, mirroring
 * GeospatialFieldOptionsCountryEnum in the forms-designer model package.
 */
export type GeospatialCountry =
  | "england"
  | "northern-ireland"
  | "scotland"
  | "wales";

/**
 * Geometry a GeospatialField lets the user draw, mirroring
 * GeospatialFieldGeometryTypesEnum in the forms-designer model package.
 */
export type GeospatialGeometryType = "point" | "line" | "shape";

/**
 * How a List content component renders its items, mirroring ListTypeOption in
 * the forms-designer model package.
 */
export type ListDisplayType = "bulleted" | "numbered";

/**
 * Telephone number formats, mirroring TelephoneNumberFieldOptionsFormatEnum in
 * the forms-designer model package.
 */
export type TelephoneNumberFormat = "uk" | "international";

/**
 * Optional map layers a precise location field can display.
 */
export interface MapLayers {
  /** Sites of Special Scientific Interest */
  sssi?: boolean;
}

/**
 * A payment amount that applies only when a named condition is met. Amounts are
 * evaluated in order and the first match wins.
 */
export interface ConditionalAmount {
  /** Condition id */
  condition: string;
  amount: number;
}

export type ComponentType = InputComponentType | ContentComponentType;

export type OperatorName =
  | "is"
  | "is not"
  | "is longer than"
  | "is shorter than"
  | "has length"
  | "contains"
  | "does not contain"
  | "is at least"
  | "is at most"
  | "is less than"
  | "is more than"
  | "is before"
  | "is after";

export interface ListItem {
  id: string;
  text: string;
  value: string;
  hint?: { text: string; id: string };
}

export interface List {
  id: string;
  name: string;
  title: string;
  type: "string" | "number" | "boolean";
  items: ListItem[];
}

export interface Component {
  id: string;
  type: ComponentType;
  name?: string;
  title?: string;
  hint?: string;
  shortDescription?: string;
  errorDescription?: string;
  content?: string;
  list?: string;
  options: Record<string, unknown>;
  schema: Record<string, unknown>;
}

export type ControllerType =
  | "StartPageController"
  | "PageController"
  | "RepeatPageController"
  | "FileUploadPageController"
  | "TerminalPageController"
  | "SummaryPageController"
  | "SummaryPageWithConfirmationEmailController"
  | "StatusPageController";

export interface RepeatOptions {
  name: string;
  title: string;
}

export interface RepeatSchema {
  min: number;
  max: number;
}

export interface Repeat {
  options: RepeatOptions;
  schema: RepeatSchema;
}

export interface Page {
  id: string;
  title: string;
  path: string;
  controller?: ControllerType;
  next: never[];
  components: Component[];
  condition?: string;
  repeat?: Repeat;
}

export interface ConditionItem {
  id: string;
  componentId: string;
  operator: OperatorName;
  type: string;
  value: unknown;
}

export interface ConditionRef {
  id: string;
  conditionId: string;
}

export interface Condition {
  id: string;
  displayName: string;
  coordinator?: "and" | "or";
  items: (ConditionItem | ConditionRef)[];
}

export interface FormDefinition {
  name: string;
  engine: "V2";
  schema: 2;
  startPage: string;
  pages: Page[];
  conditions: Condition[];
  lists: List[];
  sections: never[];
}

export const LIST_COMPONENT_TYPES = new Set<ComponentType>([
  "RadiosField",
  "CheckboxesField",
  "SelectField",
  "AutocompleteField",
]);

export const CONTENT_COMPONENT_TYPES = new Set<ComponentType>([
  "Markdown",
  "Html",
  "Details",
  "InsetText",
  "List",
  "NotificationBanner",
]);

/**
 * Content components that carry their own text rather than referencing a list.
 * The List component is the exception — it renders items from form.lists.
 */
export const CONTENT_COMPONENT_TYPES_WITH_CONTENT = new Set<ComponentType>([
  "Markdown",
  "Html",
  "Details",
  "InsetText",
  "NotificationBanner",
]);

/**
 * Payment bounds enforced by the forms-designer Joi schema. A conditional
 * amount has a higher floor than the base amount because GOV.UK Pay rejects
 * charges below 30p.
 */
export const MIN_PAYMENT_AMOUNT = 0;
export const MAX_PAYMENT_AMOUNT = 100000;
export const MIN_CONDITIONAL_PAYMENT_AMOUNT = 0.3;
export const MAX_PAYMENT_DESCRIPTION_LENGTH = 230;

/**
 * Repeat item bounds, mirroring MIN_NUMBER_OF_REPEAT_ITEMS and
 * MAX_NUMBER_OF_REPEAT_ITEMS in the forms-designer model package.
 */
export const MIN_NUMBER_OF_REPEAT_ITEMS = 1;
export const MAX_NUMBER_OF_REPEAT_ITEMS = 200;

/**
 * Default bounds applied when a repeat page is added without them. Matches the
 * "Add another" page template in the forms-designer model package — 200 is the
 * schema ceiling, not a sensible default for a form.
 */
export const DEFAULT_REPEAT_MIN = 1;
export const DEFAULT_REPEAT_MAX = 25;
