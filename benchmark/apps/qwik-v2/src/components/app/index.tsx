import {
  component$,
  useSignal,
  useStore,
  $,
  type QwikIntrinsicElements,
  type FunctionComponent,
  createContextId,
  useContext,
  useContextProvider,
} from "@qwik.dev/core";

type Item = { id: number; label: string; selected: boolean };

let idCounter = 1;
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
  ],
  colours = [
    "red",
    "yellow",
    "blue",
    "green",
    "pink",
    "brown",
    "purple",
    "brown",
    "white",
    "black",
    "orange",
  ],
  nouns = [
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

function _random(max: number) {
  return Math.round(Math.random() * 1000) % max;
}

export function buildData(count: number): Item[] {
  let data: Item[] = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: idCounter++,
      label: `${adjectives[_random(adjectives.length)]} ${
        colours[_random(colours.length)]
      } ${nouns[_random(nouns.length)]}`,
      selected: false,
    };
  }
  return data;
}

const helpers = createContextId<{
  reset$: (count: number) => void;
  update$: () => void;
  add$: () => void;
  swap$: () => void;
  select$: (item: Item) => void;
  delete$: (item: Item) => void;
}>("h");

const Button: FunctionComponent<QwikIntrinsicElements["button"]> = (props) => (
  <div>
    <button type="button" class="w-full rounded bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-700" {...props} />
  </div>
);

const Row = component$<{
  item: Item;
}>(({ item }) => {
  const { select$, delete$ } = useContext(helpers);
  return (
    <tr class={item.selected ? "is-selected" : ""}>
      <td class="w-16 px-3 py-2 text-slate-500">{item.id}</td>
      <td class="w-1/3 px-3 py-2">
        <a class="text-sky-700 hover:text-sky-900" onClick$={() => select$(item)}>{item.label}</a>
      </td>
      <td class="px-3 py-2">
        <a class="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-900" onClick$={() => delete$(item)}>
          <span aria-hidden="true">x</span>
        </a>
      </td>
      <td class="px-3 py-2" />
    </tr>
  );
});

const Table = component$<{
  data: Item[];
}>(({ data }) => (
  <table class="w-full border-collapse bg-white text-sm text-slate-900 test-data">
    <tbody>
      {data.map((item) => (
        <Row key={item.id} item={item} />
      ))}
    </tbody>
  </table>
));

export const Buttons = component$(() => {
  const h = useContext(helpers);
  return (
    <>
      <Button id="run" onClick$={() => h.reset$(1000)}>
        Create 1,000 rows
      </Button>
      <Button id="runlots" onClick$={() => h.reset$(10000)}>
        Create 10,000 rows
      </Button>
      <Button id="add" onClick$={h.add$}>
        Append 1,000 rows
      </Button>
      <Button id="update" onClick$={h.update$}>
        Update every 10th row
      </Button>
      <Button id="clear" onClick$={() => h.reset$(0)}>
        Clear
      </Button>
      <Button id="swaprows" onClick$={h.swap$}>
        Swap Rows
      </Button>
    </>
  );
});

type BenchState = {
  data: Item[];
};
export const App = component$(() => {
  const state = useStore<BenchState>({ data: [] });
  const selectedItem = useSignal<Item | null>(null);
  const redraw = useSignal(0);
  useContextProvider(helpers, {
    reset$: $((count: number) => {
      state.data = buildData(count);
      selectedItem.value = null;
      redraw.value++;
    }),
    update$: $(() => {
      state.data = state.data.map((item, index) =>
        index % 10 === 0 ? { ...item, label: item.label + " !!!" } : item,
      );
    }),
    add$: $(() => state.data.push(...buildData(1000))),
    swap$: $(() => {
      const d = state.data;
      if (d.length > 998) {
        let tmp = d[1];
        d[1] = d[998];
        d[998] = tmp;
      }
    }),
    select$: $((item: Item) => {
      if (selectedItem.value) selectedItem.value.selected = false;
      selectedItem.value = item;
      item.selected = true;
    }),
    delete$: $((item: Item) => {
      state.data.splice(state.data.indexOf(item), 1);
      if (selectedItem.value === item) selectedItem.value = null;
    }),
  });

  return (
    <div class="min-h-screen bg-slate-50 py-8">
      <div class="mx-auto max-w-7xl px-6">
      <div class="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 class="text-4xl font-semibold tracking-normal text-slate-900">Qwik 2 beta</h1>
          </div>
          <div class="w-full">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Buttons />
            </div>
          </div>
        </div>
      </div>
      <Table key={redraw.value} data={state.data} />
      </div>
    </div>
  );
});
