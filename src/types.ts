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
  | "DeclarationField";

export type ContentComponentType =
  | "Markdown"
  | "Html"
  | "Details"
  | "InsetText"
  | "NotificationBanner";

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
  content?: string;
  list?: string;
  options: Record<string, unknown>;
  schema: Record<string, unknown>;
}

export interface Page {
  id: string;
  title: string;
  path: string;
  controller?: string;
  next: never[];
  components: Component[];
  condition?: string;
  repeat?: {
    options: { name: string; title: string };
    schema: { min: number; max: number };
  };
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
