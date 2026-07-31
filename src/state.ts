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
import { LIST_COMPONENT_TYPES } from "./types.js";

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
  listItems?: Array<{ text: string; value: string; hint?: string }>;
  maxLength?: number;
  minLength?: number;
  regex?: string;
  rows?: number;
  maxWords?: number;
  minValue?: number;
  maxValue?: number;
  prefix?: string;
  suffix?: string;
  maxDaysInPast?: number;
  maxDaysInFuture?: number;
  content?: string;
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
        break;
      }
      case "NumberField": {
        if (params.maxValue !== undefined) { schema.max = params.maxValue; }
        if (params.minValue !== undefined) { schema.min = params.minValue; }
        if (params.prefix) { options.prefix = params.prefix; }
        if (params.suffix) { options.suffix = params.suffix; }
        break;
      }
      case "DatePartsField":
      case "MonthYearField": {
        if (params.maxDaysInPast !== undefined) { options.maxDaysInPast = params.maxDaysInPast; }
        if (params.maxDaysInFuture !== undefined) { options.maxDaysInFuture = params.maxDaysInFuture; }
        break;
      }
      case "DeclarationField": {
        if (params.content) {
          component.content = params.content;
        }
        break;
      }
    }

    page.components.push(component);
  }

  addContent(type: string, content: string, hint?: string): void {
    const page = this.requireCurrentPage();
    const component: Component = {
      id: randomUUID(),
      type: type as ComponentType,
      name: generateShortName(),
      options: {},
      schema: {},
      content,
    };
    if (hint) {
      component.hint = hint;
    }
    page.components.push(component);
  }

  addPageCondition(params: AddConditionParams): void {
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

  async saveForm(outputDir?: string): Promise<string> {
    const form = this.requireForm();

    const hasSummary = form.pages.some((p) => p.path === "/summary");
    if (!hasSummary) {
      form.pages.push({
        id: randomUUID(),
        title: "Check your answers",
        path: "/summary",
        controller: "SummaryPageController",
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
