"use strict";

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

function random(max) {
  return Math.round(Math.random() * 1000) % max;
}

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

  runLots() {
    this.data = this.buildData(10000);
    this.selected = null;
  }

  add() {
    this.data = this.data.concat(this.buildData(1000));
    this.selected = null;
  }

  update() {
    for (let index = 0; index < this.data.length; index += 10) {
      this.data[index] = {
        id: this.data[index].id,
        label: `${this.data[index].label} !!!`,
      };
    }
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

  select(id) {
    this.selected = id;
  }

  remove(id) {
    this.data = this.data.filter((row) => row.id !== id);
    if (this.selected === id) this.selected = null;
  }
}

class BenchmarkApp {
  constructor() {
    this.store = new Store();
    this.tbody = document.getElementById("tbody");
  }

  run() {
    this.store.run();
    this.render();
  }

  runLots() {
    this.store.runLots();
    this.render();
  }

  add() {
    this.store.add();
    this.render();
  }

  update() {
    this.store.update();
    this.render();
  }

  clear() {
    this.store.clear();
    this.render();
  }

  swapRows() {
    this.store.swapRows();
    this.render();
  }

  select(id) {
    this.store.select(id);
    this.render();
  }

  remove(id) {
    this.store.remove(id);
    this.render();
  }

  render() {
    this.tbody.innerHTML = this.store.data.map((row) => this.renderRow(row)).join("");
    globalThis.htmx?.process(this.tbody);
  }

  renderRow(row) {
    const selectedClass = this.store.selected === row.id ? " class=\"is-selected\"" : "";
    return `<tr data-row-id="${row.id}"${selectedClass}>
      <td class="w-16 px-3 py-2 text-slate-500">${row.id}</td>
      <td class="w-1/3 px-3 py-2">
        <a class="text-sky-700 hover:text-sky-900" hx-on:click="benchmark.select(${row.id})">${row.label}</a>
      </td>
      <td class="px-3 py-2">
        <a class="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-900" hx-on:click="benchmark.remove(${row.id})">
          <span aria-hidden="true">x</span>
        </a>
      </td>
      <td class="px-3 py-2"></td>
    </tr>`;
  }
}

globalThis.benchmark = new BenchmarkApp();
