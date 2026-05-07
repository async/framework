/** @jsx jsx */
/** @jsxFrag Fragment */
import {
  createAsyncFramework,
  createFormMachine,
  Fragment,
  jsx,
  mountReactive,
} from "../../index.ts";

const root = document.querySelector("#app");
const framework = createAsyncFramework({ root });

const form = createFormMachine({
  initialValues: { email: "", message: "" },
  validate(values) {
    const errors = {};
    if (!String(values.email).includes("@")) errors.email = "Valid email required";
    if (!String(values.message).trim()) errors.message = "Message is required";
    return errors;
  },
  async submit(values) {
    await sleep(250);
    return { id: crypto.randomUUID(), ...values };
  },
});

framework.handlers.registerHandlers({
  "form/update-email": ({ element }) => form.change("email", element.value),
  "form/update-message": ({ element }) => form.change("message", element.value),
  "form/submit": async ({ event }) => {
    event.preventDefault();
    await form.submit();
  },
  "form/reset": () => form.reset(),
});

function App() {
  return (
    <section>
      <h1>Form Machine</h1>
      <p>Machine state: <strong>{form.machine.state}</strong></p>
      <form {...{"on:submit": "form/submit"}}>
        <label>Email
          <input value={String(form.values.value.email)} {...{"on:input": "form/update-email"}} />
        </label>
        <p>{form.errors.value.email ?? ""}</p>

        <label>Message
          <textarea {...{"on:input": "form/update-message"}}>{String(form.values.value.message)}</textarea>
        </label>
        <p>{form.errors.value.message ?? ""}</p>
        <p>{form.errors.value.form ?? ""}</p>

        <button type="submit">Submit</button>
        <button type="button" {...{"on:click": "form/reset"}}>Reset</button>
      </form>
      <pre>{JSON.stringify(form.lastResult.value, null, 2)}</pre>
    </section>
  );
}

mountReactive(root, () => App());
framework.start();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
