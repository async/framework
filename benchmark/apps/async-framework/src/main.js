import { Async } from "/framework/browser.js";

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

const rowTemplate = document.createElement("tr");
rowTemplate.innerHTML =
  "<td class='w-16 px-3 py-2 text-slate-500'> </td><td class='w-1/3 px-3 py-2'><a class='text-sky-700 hover:text-sky-900' data-row-action='select'> </a></td><td class='px-3 py-2'><a class='inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-900' data-row-action='delete'><span aria-hidden='true'>x</span></a></td><td class='px-3 py-2'></td>";

class Store {
  constructor() {
    this.data = [];
    this.selected = null;
    this.id = 1;
  }

  buildData(count = 1000) {
    const data = [];
    for (let index = 0; index < count; index++) {
      data.push({
        id: this.id++,
        label: `${adjectives[random(adjectives.length)]} ${colours[random(colours.length)]} ${nouns[random(nouns.length)]}`,
      });
    }
    return data;
  }

  run() {
    this.data = this.buildData();
    this.selected = null;
  }

  add() {
    this.data = this.data.concat(this.buildData(1000));
    this.selected = null;
  }

  update() {
    for (let index = 0; index < this.data.length; index += 10) {
      this.data[index].label += " !!!";
    }
    this.selected = null;
  }

  select(id) {
    this.selected = id;
  }

  delete(id) {
    const index = this.data.findIndex((row) => row.id === id);
    this.data = this.data.filter((_, rowIndex) => rowIndex !== index);
  }

  runLots() {
    this.data = this.buildData(10000);
    this.selected = null;
  }

  clear() {
    this.data = [];
    this.selected = null;
  }

  swapRows() {
    if (this.data.length > 998) {
      const row = this.data[1];
      this.data[1] = this.data[998];
      this.data[998] = row;
    }
  }
}

class RowsApp {
  constructor() {
    this.store = new Store();
    this.tbody = document.getElementById("tbody");
    this.table = document.getElementsByTagName("table")[0];
    this.rows = [];
    this.data = [];
    this.selectedRow = undefined;

    this.tbody.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      const action = target?.closest("[data-row-action]");
      if (!action) return;
      const row = action.closest("tr");
      if (!row) return;
      const id = row.dataId;
      const index = this.data.findIndex((entry) => entry.id === id);
      if (index === -1) return;
      if (action.dataset.rowAction === "select") {
        this.select(index);
      } else {
        this.delete(index);
      }
    });
  }

  run() {
    this.removeAllRows();
    this.store.clear();
    this.rows = [];
    this.data = [];
    this.store.run();
    this.appendRows();
    this.unselect();
  }

  add() {
    this.store.add();
    this.appendRows();
  }

  update() {
    this.store.update();
    for (let index = 0; index < this.data.length; index += 10) {
      this.rows[index].childNodes[1].childNodes[0].firstChild.nodeValue = this.store.data[index].label;
    }
  }

  unselect() {
    if (this.selectedRow !== undefined) {
      this.selectedRow.className = "";
      this.selectedRow = undefined;
    }
  }

  select(index) {
    this.unselect();
    this.store.select(this.data[index].id);
    this.selectedRow = this.rows[index];
    this.selectedRow.className = "is-selected";
  }

  recreateSelection() {
    const oldSelection = this.store.selected;
    const selectionIndex = this.store.data.findIndex((row) => row.id === oldSelection);
    if (selectionIndex >= 0) {
      this.store.select(this.data[selectionIndex].id);
      this.selectedRow = this.rows[selectionIndex];
      this.selectedRow.className = "is-selected";
    }
  }

  delete(index) {
    this.store.delete(this.data[index].id);
    this.rows[index].remove();
    this.rows.splice(index, 1);
    this.data.splice(index, 1);
    this.unselect();
    this.recreateSelection();
  }

  removeAllRows() {
    this.tbody.textContent = "";
  }

  runLots() {
    this.removeAllRows();
    this.store.clear();
    this.rows = [];
    this.data = [];
    this.store.runLots();
    this.appendRows();
    this.unselect();
  }

  clear() {
    this.store.clear();
    this.rows = [];
    this.data = [];
    this.removeAllRows();
    this.unselect();
  }

  swapRows() {
    if (this.data.length > 10) {
      this.store.swapRows();
      this.data[1] = this.store.data[1];
      this.data[998] = this.store.data[998];

      this.tbody.insertBefore(this.rows[998], this.rows[2]);
      this.tbody.insertBefore(this.rows[1], this.rows[999]);

      const row = this.rows[998];
      this.rows[998] = this.rows[1];
      this.rows[1] = row;
    }
  }

  appendRows() {
    const empty = !this.tbody.firstChild;
    if (empty) this.tbody.remove();
    for (let index = this.rows.length; index < this.store.data.length; index++) {
      const tr = this.createRow(this.store.data[index]);
      this.rows[index] = tr;
      this.data[index] = this.store.data[index];
      this.tbody.appendChild(tr);
    }
    if (empty) this.table.insertBefore(this.tbody, null);
  }

  createRow(data) {
    const tr = rowTemplate.cloneNode(true);
    const td1 = tr.firstChild;
    const a2 = td1.nextSibling.firstChild;
    tr.dataId = data.id;
    td1.firstChild.nodeValue = data.id;
    a2.firstChild.nodeValue = data.label;
    return tr;
  }
}

const rows = new RowsApp();

Async.use({
  handler: {
    "rows.run": () => rows.run(),
    "rows.runLots": () => rows.runLots(),
    "rows.add": () => rows.add(),
    "rows.update": () => rows.update(),
    "rows.clear": () => rows.clear(),
    "rows.swapRows": () => rows.swapRows(),
  },
});

Async.start({ root: document.getElementById("main"), router: false });
