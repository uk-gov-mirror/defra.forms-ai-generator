import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import { join } from "path";
import type {
  FormDefinition,
  Page,
  Component,
  Condition,
  ListItem,
  OperatorName,
  ComponentType,
} from "./types.js";
import type {
  ConditionalAmount,
  GeospatialCountry,
  ListDisplayType,
  GeospatialGeometryType,
  MapLayers,
  TelephoneNumberFormat,
} from "./types.js";
import {
  DEFAULT_REPEAT_MAX,
  DEFAULT_REPEAT_MIN,
  CONTENT_COMPONENT_TYPES,
  CONTENT_COMPONENT_TYPES_WITH_CONTENT,
  LIST_COMPONENT_TYPES,
  MAX_NUMBER_OF_REPEAT_ITEMS,
  MAX_PAYMENT_AMOUNT,
  MAX_PAYMENT_DESCRIPTION_LENGTH,
  MIN_CONDITIONAL_PAYMENT_AMOUNT,
  MIN_NUMBER_OF_REPEAT_ITEMS,
  MIN_PAYMENT_AMOUNT,
} from "./types.js";

function generateShortName(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export interface AddQuestionParams {
  type: string;
  title: string;
  name: string;
  hint?: string;
  required?: boolean;
  shortDescription?: string;
  errorDescription?: string;
  listItems?: Array<{ text: string; value: string; hint?: string }>;
  maxLength?: number;
  minLength?: number;
  regex?: string;
  rows?: number;
  maxWords?: number;
  minValue?: number;
  maxValue?: number;
  precision?: number;
  minPrecision?: number;
  prefix?: string;
  suffix?: string;
  maxDaysInPast?: number;
  maxDaysInFuture?: number;
  earliestDate?: string;
  latestDate?: string;
  earliestMonthYear?: string;
  latestMonthYear?: string;
  content?: string;
  autocomplete?: string;
  classes?: string;
  optionalText?: boolean;
  instructionText?: string;
  customValidationMessage?: string;
  usePostcodeLookup?: boolean;
  hideTitle?: boolean;
  bold?: boolean;
  telephoneFormat?: TelephoneNumberFormat;
  accept?: string;
  minFiles?: number;
  maxFiles?: number;
  declarationConfirmationLabel?: string;
  minSelected?: number;
  maxSelected?: number;
  amount?: number;
  paymentDescription?: string;
  conditionalAmounts?: ConditionalAmount[];
  emailField?: string;
  countries?: GeospatialCountry[];
  geometryTypes?: GeospatialGeometryType[];
  mapLayers?: MapLayers;
  minEasting?: number;
  maxEasting?: number;
  minNorthing?: number;
  maxNorthing?: number;
  minLatitude?: number;
  maxLatitude?: number;
  minLongitude?: number;
  maxLongitude?: number;
  minFeatures?: number;
  maxFeatures?: number;
}

export interface AddContentParams {
  type: string;
  content?: string;
  title?: string;
  hint?: string;
  listItems?: Array<{ text: string; value: string; hint?: string }>;
  listType?: ListDisplayType;
  classes?: string;
  hideTitle?: boolean;
  bold?: boolean;
  success?: boolean;
  heading?: string;
}

export interface AddRepeatPageParams {
  title: string;
  path: string;
  itemTitle: string;
  min?: number;
  max?: number;
}

export interface AddConditionParams {
  displayName: string;
  componentName: string;
  operator: OperatorName;
  value: string;
}

export interface AddCompositeConditionParams {
  displayName: string;
  coordinator: "and" | "or";
  conditionNames: string[];
}

export class FormState {
  private form: FormDefinition | null = null;
  private currentPageIndex: number = -1;

  createForm(name: string): void {
    this.form = {
      name,
      engine: "V2",
      schema: 2,
      startPage: "/summary",
      pages: [],
      conditions: [],
      lists: [],
      sections: [],
    };
    this.currentPageIndex = -1;
  }

  private requireForm(): FormDefinition {
    if (!this.form) {
      throw new Error("No form created. Call create_form first.");
    }
    return this.form;
  }

  private requireCurrentPage(): Page {
    const form = this.requireForm();
    if (this.currentPageIndex < 0 || this.currentPageIndex >= form.pages.length) {
      throw new Error("No current page. Call add_page or add_guidance_page first.");
    }
    return form.pages[this.currentPageIndex];
  }

  private findComponentByName(name: string): Component | undefined {
    const form = this.requireForm();
    for (const page of form.pages) {
      const component = page.components.find((c) => c.name === name);
      if (component) {
        return component;
      }
    }
    return undefined;
  }

  addPage(title: string, path: string): void {
    const form = this.requireForm();
    const page: Page = {
      id: randomUUID(),
      title,
      path,
      next: [],
      components: [],
    };
    form.pages.push(page);
    this.currentPageIndex = form.pages.length - 1;
  }

  addGuidancePage(title: string, path: string, content: string): void {
    const form = this.requireForm();
    const page: Page = {
      id: randomUUID(),
      title,
      path,
      next: [],
      components: [
        {
          id: randomUUID(),
          type: "Markdown",
          name: generateShortName(),
          options: {},
          schema: {},
          content,
        },
      ],
    };
    form.pages.push(page);
    this.currentPageIndex = form.pages.length - 1;
  }

  addRepeatPage(params: AddRepeatPageParams): void {
    const form = this.requireForm();

    const min = params.min ?? DEFAULT_REPEAT_MIN;
    const max = params.max ?? DEFAULT_REPEAT_MAX;

    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error("Repeat min and max must be whole numbers.");
    }
    if (min < MIN_NUMBER_OF_REPEAT_ITEMS) {
      throw new Error(
        `Repeat min must be at least ${MIN_NUMBER_OF_REPEAT_ITEMS}, got ${min}.`
      );
    }
    if (max > MAX_NUMBER_OF_REPEAT_ITEMS) {
      throw new Error(
        `Repeat max must be at most ${MAX_NUMBER_OF_REPEAT_ITEMS}, got ${max}.`
      );
    }
    if (max < min) {
      throw new Error(`Repeat max (${max}) must be at least the min (${min}).`);
    }

    const page: Page = {
      id: randomUUID(),
      title: params.title,
      path: params.path,
      controller: "RepeatPageController",
      next: [],
      components: [],
      repeat: {
        options: { name: generateShortName(), title: params.itemTitle },
        schema: { min, max },
      },
    };
    form.pages.push(page);
    this.currentPageIndex = form.pages.length - 1;
  }

  setCurrentPage(path: string): void {
    const form = this.requireForm();
    const index = form.pages.findIndex((p) => p.path === path);
    if (index === -1) {
      throw new Error(`No page with path "${path}" found.`);
    }
    this.currentPageIndex = index;
  }

  addQuestion(params: AddQuestionParams): void {
    const form = this.requireForm();
    const page = this.requireCurrentPage();

    if (params.type === "FileUploadField" && page.repeat) {
      throw new Error(
        `Cannot add a FileUploadField to repeating page "${page.path}". A page holding a file upload uses FileUploadPageController, which cannot also repeat. Put the upload on its own non-repeating page.`
      );
    }

    // A file upload page accepts one FileUploadField and nothing else besides
    // guidance, so a mixed page fails validation.
    const hasUpload = page.components.some((c) => c.type === "FileUploadField");
    if (params.type === "FileUploadField") {
      if (hasUpload) {
        throw new Error(
          `Page "${page.path}" already has a file upload. A page can hold only one FileUploadField. Put the second upload on its own page.`
        );
      }
      const otherQuestions = page.components.filter(
        (c) => !CONTENT_COMPONENT_TYPES.has(c.type)
      );
      if (otherQuestions.length > 0) {
        throw new Error(
          `Cannot add a FileUploadField to page "${page.path}" because it already has other questions (${otherQuestions
            .map((c) => c.name)
            .join(", ")}). A file upload page can hold only the upload and guidance. Put the upload on its own page.`
        );
      }
    } else if (hasUpload) {
      throw new Error(
        `Cannot add a ${params.type} to page "${page.path}" because it holds a file upload. A file upload page can hold only the upload and guidance. Put this question on its own page.`
      );
    }

    // A page holding a file upload must use FileUploadPageController, otherwise
    // the runtime renders it as an ordinary page and the upload does not work.
    if (params.type === "FileUploadField") {
      page.controller = "FileUploadPageController";
    }

    const required = params.required !== false;
    const options: Record<string, unknown> = { required };
    const schema: Record<string, unknown> = {};

    const component: Component = {
      id: randomUUID(),
      type: params.type as ComponentType,
      name: params.name,
      title: params.title,
      options,
      schema,
    };

    if (params.hint) {
      component.hint = params.hint;
    }
    if (params.shortDescription) {
      component.shortDescription = params.shortDescription;
    }
    if (params.errorDescription) {
      component.errorDescription = params.errorDescription;
    }

    // Options every input field accepts, regardless of type.
    if (params.classes) {
      options.classes = params.classes;
    }
    if (params.optionalText !== undefined) {
      options.optionalText = params.optionalText;
    }
    if (params.instructionText) {
      options.instructionText = params.instructionText;
    }
    if (params.customValidationMessage) {
      options.customValidationMessage = params.customValidationMessage;
    }
    if (params.autocomplete) {
      options.autocomplete = params.autocomplete;
    }

    if (LIST_COMPONENT_TYPES.has(params.type as ComponentType)) {
      const items: ListItem[] = (params.listItems ?? []).map((item) => ({
        id: randomUUID(),
        text: item.text,
        value: item.value,
        ...(item.hint ? { hint: { text: item.hint, id: randomUUID() } } : {}),
      }));
      const list = {
        id: randomUUID(),
        name: generateShortName(),
        title: `List for question ${params.name}`,
        type: "string" as const,
        items,
      };
      form.lists.push(list);
      component.list = list.id;
    }

    switch (params.type) {
      case "TextField":
      case "MultilineTextField":
      case "EmailAddressField":
      case "TelephoneNumberField": {
        if (params.maxLength !== undefined) { schema.max = params.maxLength; }
        if (params.minLength !== undefined) { schema.min = params.minLength; }
        if (params.regex) { schema.regex = params.regex; }
        if (params.type === "MultilineTextField") {
          if (params.rows !== undefined) { options.rows = params.rows; }
          if (params.maxWords !== undefined) { options.maxWords = params.maxWords; }
        }
        if (params.type === "TelephoneNumberField" && params.telephoneFormat) {
          options.format = params.telephoneFormat;
        }
        break;
      }
      case "NumberField": {
        if (params.maxValue !== undefined) { schema.max = params.maxValue; }
        if (params.minValue !== undefined) { schema.min = params.minValue; }
        if (params.precision !== undefined) { schema.precision = params.precision; }
        if (params.minPrecision !== undefined) { schema.minPrecision = params.minPrecision; }
        if (params.maxLength !== undefined) { schema.maxLength = params.maxLength; }
        if (params.minLength !== undefined) { schema.minLength = params.minLength; }
        if (params.prefix) { options.prefix = params.prefix; }
        if (params.suffix) { options.suffix = params.suffix; }
        break;
      }
      case "DatePartsField": {
        if (params.maxDaysInPast !== undefined) { options.maxDaysInPast = params.maxDaysInPast; }
        if (params.maxDaysInFuture !== undefined) { options.maxDaysInFuture = params.maxDaysInFuture; }
        if (params.earliestDate) { options.earliestDate = params.earliestDate; }
        if (params.latestDate) { options.latestDate = params.latestDate; }
        break;
      }
      case "MonthYearField": {
        // A month/year field is bounded by earliest/latest month, not by a day
        // count — maxDaysInPast and maxDaysInFuture do not apply to this type.
        if (params.earliestMonthYear) { options.earliestMonthYear = params.earliestMonthYear; }
        if (params.latestMonthYear) { options.latestMonthYear = params.latestMonthYear; }
        break;
      }
      case "UkAddressField": {
        // Postcode lookup is the default because it is quicker and more accurate
        // for the user than typing the address out. Pass false where the address
        // may not be on the postcode file, such as land parcels or new builds.
        options.usePostcodeLookup = params.usePostcodeLookup !== false;
        if (params.hideTitle !== undefined) { options.hideTitle = params.hideTitle; }
        break;
      }
      case "RadiosField":
      case "CheckboxesField": {
        if (params.bold !== undefined) { options.bold = params.bold; }
        if (params.type === "CheckboxesField") {
          if (params.minSelected !== undefined) { schema.min = params.minSelected; }
          if (params.maxSelected !== undefined) { schema.max = params.maxSelected; }
        }
        break;
      }
      case "FileUploadField": {
        if (params.accept) { options.accept = params.accept; }
        if (params.minFiles !== undefined) { schema.min = params.minFiles; }
        if (params.maxFiles !== undefined) { schema.max = params.maxFiles; }
        break;
      }
      case "DeclarationField": {
        if (params.content) {
          component.content = params.content;
        }
        if (params.declarationConfirmationLabel) {
          options.declarationConfirmationLabel = params.declarationConfirmationLabel;
        }
        break;
      }
      case "PaymentField": {
        this.applyPaymentOptions(params, options);
        break;
      }
      case "GeospatialField": {
        if (params.countries?.length) { options.countries = params.countries; }
        if (params.geometryTypes?.length) { options.geometryTypes = params.geometryTypes; }
        if (params.mapLayers) { options.mapLayers = params.mapLayers; }
        if (params.minFeatures !== undefined) { schema.min = params.minFeatures; }
        if (params.maxFeatures !== undefined) { schema.max = params.maxFeatures; }
        break;
      }
      case "EastingNorthingField": {
        if (params.countries?.length) { options.countries = params.countries; }
        if (params.mapLayers) { options.mapLayers = params.mapLayers; }
        const easting: Record<string, number> = {};
        if (params.minEasting !== undefined) { easting.min = params.minEasting; }
        if (params.maxEasting !== undefined) { easting.max = params.maxEasting; }
        if (Object.keys(easting).length > 0) { schema.easting = easting; }
        const northing: Record<string, number> = {};
        if (params.minNorthing !== undefined) { northing.min = params.minNorthing; }
        if (params.maxNorthing !== undefined) { northing.max = params.maxNorthing; }
        if (Object.keys(northing).length > 0) { schema.northing = northing; }
        break;
      }
      case "LatLongField": {
        if (params.mapLayers) { options.mapLayers = params.mapLayers; }
        const latitude: Record<string, number> = {};
        if (params.minLatitude !== undefined) { latitude.min = params.minLatitude; }
        if (params.maxLatitude !== undefined) { latitude.max = params.maxLatitude; }
        if (Object.keys(latitude).length > 0) { schema.latitude = latitude; }
        const longitude: Record<string, number> = {};
        if (params.minLongitude !== undefined) { longitude.min = params.minLongitude; }
        if (params.maxLongitude !== undefined) { longitude.max = params.maxLongitude; }
        if (Object.keys(longitude).length > 0) { schema.longitude = longitude; }
        break;
      }
      case "OsGridRefField": {
        if (params.mapLayers) { options.mapLayers = params.mapLayers; }
        break;
      }
    }

    page.components.push(component);
  }

  addContent(params: AddContentParams): void {
    const form = this.requireForm();
    const page = this.requireCurrentPage();
    const options: Record<string, unknown> = {};

    const component: Component = {
      id: randomUUID(),
      type: params.type as ComponentType,
      name: generateShortName(),
      options,
      schema: {},
    };

    if (CONTENT_COMPONENT_TYPES_WITH_CONTENT.has(component.type)) {
      if (!params.content) {
        throw new Error(`A ${params.type} component needs content.`);
      }
      component.content = params.content;
    }

    if (params.title) {
      component.title = params.title;
    }
    if (params.hint) {
      component.hint = params.hint;
    }

    switch (params.type) {
      case "List": {
        if (!params.listItems?.length) {
          throw new Error(
            `A List content component needs list_items. Use it to display a bulleted or numbered list of fixed text; use RadiosField or CheckboxesField if the user has to choose one.`
          );
        }
        const items: ListItem[] = params.listItems.map((item) => ({
          id: randomUUID(),
          text: item.text,
          value: item.value,
          ...(item.hint ? { hint: { text: item.hint, id: randomUUID() } } : {}),
        }));
        const list = {
          id: randomUUID(),
          name: generateShortName(),
          title: params.title ?? `List for ${component.name}`,
          type: "string" as const,
          items,
        };
        form.lists.push(list);
        component.list = list.id;
        if (params.listType) { options.type = params.listType; }
        if (params.classes) { options.classes = params.classes; }
        if (params.hideTitle !== undefined) { options.hideTitle = params.hideTitle; }
        if (params.bold !== undefined) { options.bold = params.bold; }
        break;
      }
      case "NotificationBanner": {
        if (params.success) { options.type = "success"; }
        if (params.heading) { options.heading = params.heading; }
        break;
      }
    }

    page.components.push(component);
  }

  /**
   * Maps the payment parameters onto the component options, rejecting values the
   * forms-designer schema would refuse on import.
   */
  private applyPaymentOptions(
    params: AddQuestionParams,
    options: Record<string, unknown>
  ): void {
    if (params.amount === undefined) {
      throw new Error(
        `A PaymentField needs an amount. Pass amount as the charge in pounds, e.g. 25 for £25.`
      );
    }
    if (params.amount < MIN_PAYMENT_AMOUNT || params.amount > MAX_PAYMENT_AMOUNT) {
      throw new Error(
        `Payment amount ${params.amount} is out of range. It must be between ${MIN_PAYMENT_AMOUNT} and ${MAX_PAYMENT_AMOUNT} pounds.`
      );
    }
    if (!params.paymentDescription) {
      throw new Error(
        `A PaymentField needs a payment_description. This is the text shown on the GOV.UK Pay page and on the payer's statement.`
      );
    }
    if (params.paymentDescription.length > MAX_PAYMENT_DESCRIPTION_LENGTH) {
      throw new Error(
        `Payment description is ${params.paymentDescription.length} characters. The maximum is ${MAX_PAYMENT_DESCRIPTION_LENGTH}.`
      );
    }

    options.amount = params.amount;
    options.description = params.paymentDescription;

    if (params.conditionalAmounts?.length) {
      const form = this.requireForm();
      const resolved = params.conditionalAmounts.map((entry) => {
        if (entry.amount < MIN_CONDITIONAL_PAYMENT_AMOUNT || entry.amount > MAX_PAYMENT_AMOUNT) {
          throw new Error(
            `Conditional payment amount ${entry.amount} is out of range. It must be between ${MIN_CONDITIONAL_PAYMENT_AMOUNT} and ${MAX_PAYMENT_AMOUNT} pounds.`
          );
        }
        // Callers name the condition; the definition references it by id.
        const condition = form.conditions.find(
          (c) => c.displayName === entry.condition || c.id === entry.condition
        );
        if (!condition) {
          const available = form.conditions.map((c) => `"${c.displayName}"`).join(", ");
          throw new Error(
            `Condition "${entry.condition}" not found for the conditional payment amount. Available: ${available || "none"}. Add the condition before the PaymentField.`
          );
        }
        return { condition: condition.id, amount: entry.amount };
      });
      options.conditionalAmounts = resolved;
    }

    if (params.emailField) {
      const emailComponent = this.findComponentByName(params.emailField);
      if (!emailComponent) {
        throw new Error(
          `Email field "${params.emailField}" not found. It must be the name of an EmailAddressField already added to the form.`
        );
      }
      if (emailComponent.type !== "EmailAddressField") {
        throw new Error(
          `"${params.emailField}" is a ${emailComponent.type}, not an EmailAddressField. GOV.UK Pay prepopulates its email from an EmailAddressField only.`
        );
      }
      options.emailField = params.emailField;
    }
  }

  private findPageHoldingComponent(name: string): Page | undefined {
    const form = this.requireForm();
    return form.pages.find((p) => p.components.some((c) => c.name === name));
  }

  addPageCondition(params: AddConditionParams): string | undefined {
    const form = this.requireForm();
    const currentPage = this.requireCurrentPage();

    const component = this.findComponentByName(params.componentName);
    if (!component) {
      const available = form.pages
        .flatMap((p) => p.components)
        .filter((c) => c.name)
        .map((c) => c.name)
        .join(", ");
      throw new Error(
        `Component "${params.componentName}" not found. Available names: ${available || "none"}`
      );
    }

    let conditionType: string;
    let conditionValue: unknown;

    if (LIST_COMPONENT_TYPES.has(component.type)) {
      conditionType = "ListItemRef";
      const list = form.lists.find((l) => l.id === component.list);
      const item = list?.items.find(
        (i) => i.value === params.value || i.text === params.value
      );
      if (!item) {
        const available = list?.items.map((i) => `"${i.value}"`).join(", ") ?? "none";
        throw new Error(
          `List item "${params.value}" not found for "${params.componentName}". Available values: ${available}`
        );
      }
      conditionValue = { listId: component.list, itemId: item.id };
    } else if (component.type === "YesNoField") {
      conditionType = "BooleanValue";
      const lower = params.value.toLowerCase();
      conditionValue = lower === "true" || lower === "yes";
    } else if (component.type === "NumberField") {
      conditionType = "Value";
      conditionValue = Number(params.value);
    } else {
      conditionType = "Value";
      conditionValue = params.value;
    }

    const condition: Condition = {
      id: randomUUID(),
      displayName: params.displayName,
      items: [
        {
          id: randomUUID(),
          componentId: component.id,
          operator: params.operator,
          type: conditionType,
          value: conditionValue,
        },
      ],
    };

    form.conditions.push(condition);
    currentPage.condition = condition.id;

    const sourcePage = this.findPageHoldingComponent(params.componentName);
    if (sourcePage?.repeat) {
      return `Warning: "${params.componentName}" sits on repeating page "${sourcePage.path}", so its answer is a set of values rather than a single one. Conditions on repeated answers may not evaluate as expected — check this in the designer.`;
    }
    return undefined;
  }

  addCompositeCondition(params: AddCompositeConditionParams): void {
    const form = this.requireForm();

    const items = params.conditionNames.map((name) => {
      const existing = form.conditions.find((c) => c.displayName === name);
      if (!existing) {
        const available = form.conditions.map((c) => `"${c.displayName}"`).join(", ");
        throw new Error(
          `Condition "${name}" not found. Available: ${available || "none"}`
        );
      }
      return { id: randomUUID(), conditionId: existing.id };
    });

    const condition: Condition = {
      id: randomUUID(),
      displayName: params.displayName,
      coordinator: params.coordinator,
      items,
    };

    form.conditions.push(condition);
  }

  applyCompositeConditionToPage(conditionDisplayName: string): void {
    const form = this.requireForm();
    const currentPage = this.requireCurrentPage();

    const condition = form.conditions.find((c) => c.displayName === conditionDisplayName);
    if (!condition) {
      const available = form.conditions.map((c) => `"${c.displayName}"`).join(", ");
      throw new Error(
        `Condition "${conditionDisplayName}" not found. Available: ${available || "none"}`
      );
    }

    currentPage.condition = condition.id;
  }

  async saveForm(outputDir?: string, confirmationEmail?: boolean): Promise<string> {
    const form = this.requireForm();

    const hasSummary = form.pages.some((p) => p.path === "/summary");
    if (!hasSummary) {
      form.pages.push({
        id: randomUUID(),
        title: "Check your answers",
        path: "/summary",
        controller: confirmationEmail
          ? "SummaryPageWithConfirmationEmailController"
          : "SummaryPageController",
        next: [],
        components: [],
      });
    }

    const dir = outputDir ?? process.cwd();
    const slug = form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const fileName = `${slug}.json`;
    const filePath = join(dir, fileName);

    await writeFile(filePath, JSON.stringify(form, null, 2), "utf-8");
    return filePath;
  }

  getStatus(): object {
    if (!this.form) {
      return { status: "no_form", message: "No form created yet." };
    }
    const form = this.form;
    const currentPage =
      this.currentPageIndex >= 0 ? form.pages[this.currentPageIndex] : null;

    return {
      formName: form.name,
      pageCount: form.pages.length,
      conditionCount: form.conditions.length,
      listCount: form.lists.length,
      currentPage: currentPage
        ? {
            title: currentPage.title,
            path: currentPage.path,
            componentCount: currentPage.components.length,
            repeat: currentPage.repeat
              ? {
                  itemTitle: currentPage.repeat.options.title,
                  min: currentPage.repeat.schema.min,
                  max: currentPage.repeat.schema.max,
                }
              : undefined,
            components: currentPage.components.map((c) => ({
              type: c.type,
              name: c.name,
              title: c.title,
            })),
          }
        : null,
      pages: form.pages.map((p, i) => ({
        index: i,
        title: p.title,
        path: p.path,
        componentCount: p.components.length,
        repeat: p.repeat
          ? `${p.repeat.options.title} (${p.repeat.schema.min}-${p.repeat.schema.max})`
          : undefined,
        condition: p.condition
          ? form.conditions.find((c) => c.id === p.condition)?.displayName
          : undefined,
      })),
      conditions: form.conditions.map((c) => ({
        displayName: c.displayName,
        id: c.id,
      })),
    };
  }

  getFormJson(): FormDefinition {
    return this.requireForm();
  }
}
