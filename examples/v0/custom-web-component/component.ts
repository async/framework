import {
  computed,
  ContextWrapper,
  each,
  html,
  signal,
  when,
  wrapContext,
} from "@async/framework-v0";

export class CounterElement extends HTMLElement {
  private wrapper: ContextWrapper;
  private count;
  private doubled;
  private isPositive;
  private isNegative;
  private history;

  constructor() {
    super();
    this.wrapper = wrapContext(this, () => {
      this.count = signal(0);
      this.doubled = computed(() => this.count.value * 2);
      this.isPositive = computed(() => this.count.value > 0);
      this.isNegative = computed(() => this.count.value < 0);
      this.history = signal<number[]>([]);
    });
  }
  createTemplate() {
    const template = html`
        <div class="p-6 bg-white rounded-lg shadow-md flex">
          <!-- Left side with counter -->
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              ${/* TODO: not inserted in correct order. inserted by appending to the parent DOM. */ ""}
              ${when(this.isPositive, () => {
                return html`
                  <div class="text-green-600 mb-2">Number is positive!</div>
                `})}
              ${when(this.isNegative, () => {
                return html`
                  <div class="text-red-600 mb-2">Number is negative!</div>
                `;
              })}
              <div class="text-2xl font-bold mb-4">
                Count: ${this.count}
              </div>
              <div class="text-sm text-gray-600 mb-4">
                Doubled: ${this.doubled}
              </div>
              
              <div class="flex gap-2">
                <button 
                  class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded"
                  on:click="./handlers/decrement.js"
                >-</button>
                <button 
                  class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded"
                  on:click="./handlers/increment.js"
                >+</button>
              </div>
            </div>
          </div>

          <!-- Right side with history -->
          <div class="flex-1 border-l pl-6 min-h-screen">
            <h3 class="font-bold mb-2">History:</h3>
            <div class="max-h-[300px] overflow-y-auto min-h-screen">
              <ul class="list-disc pl-5">
                ${
      each(this.history, (value) =>
        html`
                    <li>${value}</li>
                  `)
    }
              </ul>
            </div>
          </div>
        </div>
      `;
    return template;
  }

  connectedCallback() {
    this.innerHTML = "";
    this.render();
  }
  disconnectedCallback() {
    this.wrapper.cleanup();
  }
  render() {
    this.wrapper.render(() => this.createTemplate());
  }

  increment() {
    this.count.value++;
    this.history.value = [...this.history.value, this.count.value];
    this.wrapper.update(() => this.createTemplate());
  }

  decrement() {
    this.count.value--;
    this.history.value = [...this.history.value, this.count.value];
    this.wrapper.update(() => this.createTemplate());
  }
}
