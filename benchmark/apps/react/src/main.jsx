import { memo, useReducer } from 'react';
import { createRoot } from 'react-dom/client';

const random = (max) => Math.round(Math.random() * 1000) % max;

const A = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean",
  "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive",
  "cheap", "expensive", "fancy"];
const C = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
const N = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse",
  "keyboard"];

let nextId = 1;

const buildData = (count) => {
  const data = new Array(count);

  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}`,
    };
  }

  return data;
};

const initialState = { data: [], selected: 0 };

const listReducer = (state, action) => {
  const { data, selected } = state;

  switch (action.type) {
    case 'RUN':
      return { data: buildData(1000), selected: 0 };
    case 'RUN_LOTS':
      return { data: buildData(10000), selected: 0 };
    case 'ADD':
      return { data: data.concat(buildData(1000)), selected };
    case 'UPDATE': {
      const newData = data.slice(0);

      for (let i = 0; i < newData.length; i += 10) {
        const r = newData[i];

        newData[i] = { id: r.id, label: r.label + " !!!" };
      }

      return { data: newData, selected };
    }
    case 'CLEAR':
      return { data: [], selected: 0 };
    case 'SWAP_ROWS':
      const newdata = [...data];
      if (data.length > 998) {
        const d1 = newdata[1];
        const d998 = newdata[998];
        newdata[1] = d998;
        newdata[998] = d1;
      }
      return { data: newdata, selected };
    case 'REMOVE': {
      const idx = data.findIndex((d) => d.id === action.id);

      return { data: [...data.slice(0, idx), ...data.slice(idx + 1)], selected };
    }
    case 'SELECT':
      return { data, selected: action.id };
    default:
      return state;
  }
};

const Row = memo(({ selected, item, dispatch }) => (
    <tr className={selected ? "is-selected" : ""}>
      <td className="w-16 px-3 py-2 text-slate-500">{item.id}</td>
      <td className="w-1/3 px-3 py-2">
        <a className="text-sky-700 hover:text-sky-900" onClick={() => dispatch({ type: 'SELECT', id: item.id })}>{item.label}</a>
      </td>
      <td className="px-3 py-2">
        <a className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-900" onClick={() => dispatch({ type: 'REMOVE', id: item.id })}>
          <span aria-hidden="true">x</span>
        </a>
      </td>
      <td className="px-3 py-2" />
    </tr>
), (prevProps, nextProps) => prevProps.selected === nextProps.selected && prevProps.item === nextProps.item)

const Button = ({ id, cb, title }) => (
  <div>
    <button type="button" className="w-full rounded bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-700" id={id} onClick={cb}>{title}</button>
  </div>
);

const Jumbotron = memo(({ dispatch }) => (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
            <h1 className="text-4xl font-semibold tracking-normal text-slate-900">React</h1>
        </div>
        <div className="w-full">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button id="run" title="Create 1,000 rows" cb={() => dispatch({ type: 'RUN' })} />
            <Button id="runlots" title="Create 10,000 rows" cb={() => dispatch({ type: 'RUN_LOTS' })} />
            <Button id="add" title="Append 1,000 rows" cb={() => dispatch({ type: 'ADD' })} />
            <Button id="update" title="Update every 10th row" cb={() => dispatch({ type: 'UPDATE' })} />
            <Button id="clear" title="Clear" cb={() => dispatch({ type: 'CLEAR' })} />
            <Button id="swaprows" title="Swap Rows" cb={() => dispatch({ type: 'SWAP_ROWS' })} />
          </div>
        </div>
      </div>
    </div>
), () => true);

const Main = () => {
  const [{ data, selected }, dispatch] = useReducer(listReducer, initialState);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-6">
        <Jumbotron dispatch={dispatch} />
        <table className="w-full border-collapse bg-white text-sm text-slate-900 test-data">
          <tbody>
            {data.map(item => (
              <Row key={item.id} item={item} selected={selected === item.id} dispatch={dispatch} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

createRoot(document.getElementById("main")).render(<Main/>);
