import { createSignal, createSelector, batch } from "solid-js";
import { render } from "solid-js/web";

const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"]; // prettier-ignore
const colors = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"]; // prettier-ignore
const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"]; // prettier-ignore

const random = (max) => Math.round(Math.random() * 1000) % max;

let nextId = 1;

const buildData = (count) => {
  let data = new Array(count);
  for (let i = 0; i < count; i++) {
    const [label, setLabel] = createSignal(
      `${adjectives[random(adjectives.length)]} ${colors[random(colors.length)]} ${nouns[random(nouns.length)]}`
    );
    data[i] = { id: nextId++, label, setLabel };
  }
  return data;
};

const Button = ([id, text, fn]) => (
  <div>
    <button prop:id={id} class="w-full rounded bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-700" type="button" onClick={fn}>
      {text}
    </button>
  </div>
);

render(() => {
  const [data, setData] = createSignal([]);
  const [selected, setSelected] = createSignal(null);
  const run = () => setData(buildData(1_000));
  const runLots = () => setData(buildData(10_000));
  const add = () => setData((d) => [...d, ...buildData(1_000)]);
  const update = () =>
    batch(() => {
      for (let i = 0, d = data(), len = d.length; i < len; i += 10) d[i].setLabel((l) => l + " !!!");
    });
  const clear = () => setData([]);
  const swapRows = () => {
    const list = data().slice();
    if (list.length > 998) {
      let item = list[1];
      list[1] = list[998];
      list[998] = item;
      setData(list);
    }
  };
  const isSelected = createSelector(selected);

  return (
    <div class="min-h-screen bg-slate-50 py-8">
      <div class="mx-auto max-w-7xl px-6">
      <div class="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 class="text-4xl font-semibold tracking-normal text-slate-900">Solid 1</h1>
          </div>
          <div class="w-full">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Button {...["run", "Create 1,000 rows", run]} />
              <Button {...["runlots", "Create 10,000 rows", runLots]} />
              <Button {...["add", "Append 1,000 rows", add]} />
              <Button {...["update", "Update every 10th row", update]} />
              <Button {...["clear", "Clear", clear]} />
              <Button {...["swaprows", "Swap Rows", swapRows]} />
            </div>
          </div>
        </div>
      </div>
      <table class="w-full border-collapse bg-white text-sm text-slate-900 test-data">
        <tbody>
          <For each={data()}>
            {(row) => {
              let rowId = row.id;
              return (
                <tr class={isSelected(rowId) ? "is-selected" : ""}>
                  <td class="w-16 px-3 py-2 text-slate-500" textContent={rowId} />
                  <td class="w-1/3 px-3 py-2">
                    <a class="text-sky-700 hover:text-sky-900" onClick={() => setSelected(rowId)} textContent={row.label()} />
                  </td>
                  <td class="px-3 py-2">
                    <a class="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-900" onClick={() => setData((d) => d.toSpliced(d.findIndex((d) => d.id === rowId), 1))}>
                      <span aria-hidden="true">x</span>
                    </a>
                  </td>
                  <td class="px-3 py-2" />
                </tr>
              ); // prettier-ignore
            }}
          </For>
        </tbody>
      </table>
      </div>
    </div>
  );
}, document.getElementById("main"));
