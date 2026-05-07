import { createRunMachine } from "../agentic.ts";
import { signal } from "../signals-lite.ts";

type FormState =
  | "idle"
  | "editing"
  | "validating"
  | "submitting"
  | "success"
  | "error";

export function createFormMachine<TValues extends Record<string, unknown>>(config: {
  initialValues: TValues;
  validate?: (values: TValues) => Record<string, string>;
  submit: (values: TValues) => Promise<unknown> | unknown;
}) {
  const machine = createRunMachine<FormState>("idle", {
    idle: { CHANGE: "editing", SUBMIT: "validating" },
    editing: { CHANGE: "editing", SUBMIT: "validating", RESET: "idle" },
    validating: { VALID: "submitting", INVALID: "error" },
    submitting: { RESOLVE: "success", REJECT: "error" },
    success: { CHANGE: "editing", RESET: "idle", SUBMIT: "validating" },
    error: { CHANGE: "editing", SUBMIT: "validating", RESET: "idle" },
  });

  const values = signal<TValues>({ ...config.initialValues });
  const errors = signal<Record<string, string>>({});
  const touched = signal<Record<string, boolean>>({});
  const submitCount = signal(0);
  const lastResult = signal<unknown>(null);

  function change<K extends keyof TValues>(field: K, value: TValues[K]) {
    machine.send({ type: "CHANGE", field: String(field) });
    values.value = {
      ...values.value,
      [field]: value,
    };
    touched.value = {
      ...touched.value,
      [String(field)]: true,
    };
  }

  function reset() {
    machine.send({ type: "RESET" });
    values.value = { ...config.initialValues };
    errors.value = {};
    touched.value = {};
  }

  function runValidation() {
    const nextErrors = config.validate ? config.validate(values.value) : {};
    errors.value = nextErrors;
    if (Object.keys(nextErrors).length > 0) {
      machine.send({ type: "INVALID", errors: nextErrors });
      return false;
    }
    machine.send({ type: "VALID" });
    return true;
  }

  async function submit() {
    submitCount.value = submitCount.value + 1;
    machine.send({ type: "SUBMIT" });

    const valid = runValidation();
    if (!valid) {
      return {
        ok: false,
        errors: errors.value,
      };
    }

    try {
      const result = await config.submit(values.value);
      lastResult.value = result;
      machine.send({ type: "RESOLVE", result });
      return { ok: true, result };
    } catch (error) {
      errors.value = {
        ...errors.value,
        form: error instanceof Error ? error.message : "Submission failed",
      };
      machine.send({ type: "REJECT", error });
      return { ok: false, error };
    }
  }

  return {
    machine,
    values,
    errors,
    touched,
    submitCount,
    lastResult,
    change,
    reset,
    submit,
  };
}
