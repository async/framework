import { Async, component, html } from "/framework/browser.js";

function random(max) {
  return Math.round(Math.random() * 1000) % max;
}

const adjectives = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy",
];
const colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
const nouns = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard",
];

let nextId = 1;

const RowsTable = component(function RowsTable({ table, select, remove }) {
  return html`${table.map((row) => html`
    <tr class:is-selected="${row.selected}">
      <td class="w-16 px-3 py-2 text-slate-500" signal:text="${row.idSignal}"></td>
      <td class="w-1/3 px-3 py-2">
        <a class="text-sky-700 hover:text-sky-900" signal:text="${row.label}" on:click="${this.handler(() => select(row.id))}"></a>
      </td>
      <td class="px-3 py-2">
        <a
          class="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-900"
          on:click="${this.handler(() => remove(row.id))}"
        >
          <span aria-hidden="true">x</span>
        </a>
      </td>
      <td class="px-3 py-2"></td>
    </tr>
  `)}`;
});

const RowsBenchmark = component(function RowsBenchmark() {
  const table = this.signal("table", []);
  const selected = this.signal("selected", null);

  const createRow = () => {
    const id = nextId++;
    const label = `${adjectives[random(adjectives.length)]} ${colours[random(colours.length)]} ${nouns[random(nouns.length)]}`;
    return {
      id,
      idSignal: this.signal(`row.${id}.id`, id),
      label: this.signal(`row.${id}.label`, label),
      selected: this.computed(`row.${id}.selected`, () => selected.value === id),
    };
  };

  const buildTable = (count) => {
    const rows = new Array(count);
    for (let index = 0; index < count; index++) {
      rows[index] = createRow();
    }
    return rows;
  };

  const run = () => table.set(buildTable(1000));
  const runLots = () => table.set(buildTable(10000));
  const add = () => table.set([...table.value, ...buildTable(1000)]);
  const update = () => {
    const rows = table.value;
    for (let index = 0; index < rows.length; index += 10) {
      rows[index].label.update((label) => `${label} !!!`);
    }
  };
  const clear = () => table.set([]);
  const swapRows = () => {
    const rows = table.value.slice();
    if (rows.length > 998) {
      const row = rows[1];
      rows[1] = rows[998];
      rows[998] = row;
      table.set(rows);
    }
  };
  const select = (id) => selected.set(id);
  const remove = (id) => {
    const index = table.value.findIndex((row) => row.id === id);
    if (index === -1) return;
    table.set([...table.value.slice(0, index), ...table.value.slice(index + 1)]);
  };
  const button = ([id, text, fn]) => {
    return html`
      <div>
        <button
          type="button"
          class="w-full rounded bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-700"
          id="${id}"
          on:click="${this.handler(fn)}"
        >${text}</button>
      </div>
    `;
  };
  const tableSlot = this.slot(RowsTable, () => ({
    table: table.value,
    select,
    remove,
  }));

  return html`
    <div class="min-h-screen bg-slate-50 py-8">
      <div class="mx-auto max-w-7xl px-6">
        <div class="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 class="text-4xl font-semibold tracking-normal text-slate-900">Async Framework</h1>
            </div>
            <div class="w-full">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                ${[
                  button(["run", "Create 1,000 rows", run]),
                  button(["runlots", "Create 10,000 rows", runLots]),
                  button(["add", "Append 1,000 rows", add]),
                  button(["update", "Update every 10th row", update]),
                  button(["clear", "Clear", clear]),
                  button(["swaprows", "Swap Rows", swapRows]),
                ]}
              </div>
            </div>
          </div>
        </div>
        <table class="w-full border-collapse bg-white text-sm text-slate-900 test-data">
          <tbody id="tbody" on:attach="${tableSlot.attach}"></tbody>
        </table>
      </div>
    </div>
  `;
});

Async.use({
  component: {
    RowsBenchmark,
  },
});

Async.start({ root: document, router: false });
