import {
  computed,
  ContextWrapper,
  each,
  html,
  signal,
  when,
  wrapContext,
} from "@async/framework-v0";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export class TodoList extends HTMLElement {
  private wrapper: ContextWrapper<TodoList>;
  private todos;
  private newTodoText;
  private filter;
  private nextId;

  constructor() {
    super();

    this.wrapper = wrapContext(this, () => {
      this.todos = signal<Todo[]>([]);
      this.newTodoText = signal("");
      this.filter = signal<"all" | "active" | "completed">("all");
      this.nextId = signal(1);
    });

    this.addTodo = this.addTodo.bind(this);
    this.toggleTodo = this.toggleTodo.bind(this);
    this.deleteTodo = this.deleteTodo.bind(this);
  }

  private createTemplate() {
    const filteredTodos = computed(() => {
      const filter = this.filter.value;
      return this.todos.value.filter((todo) => {
        if (filter === "active") return !todo.completed;
        if (filter === "completed") return todo.completed;
        return true;
      });
    });

    const activeCount = computed(() =>
      this.todos.value.filter((t) => !t.completed).length
    );

    const hasCompleted = computed(() =>
      this.todos.value.some((t) => t.completed)
    );

    return html`
      <div class="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
        <h1 class="text-2xl font-bold mb-4">Todo List</h1>
        
        <!-- Input form -->
        <form class="flex gap-2 mb-6" on:submit="prevent-default.js, ./handlers/add-todo.js">
          <input 
            type="text"
            class="flex-1 px-4 py-2 border rounded"
            placeholder="What needs to be done?"
            value=${this.newTodoText}
            on:input="./handlers/update-input.js"
          >
          <button type="submit">Add</button>
        </form>

        <!-- Filters -->
        <div class="flex gap-2 mb-4">
          ${
      computed(() =>
        html`
            ${
          ["all", "active", "completed"].map((value) =>
            html`
              <button 
                class=${
              computed(() =>
                this.filter.value === value
                  ? "px-3 py-1 rounded bg-blue-500 text-white"
                  : "px-3 py-1 rounded bg-gray-200 text-gray-700"
              )
            }
                on:click="./handlers/set-filter.js"
                data-filter=${value}
              >
                ${value}
              </button>
            `
          )
        }
          `
      )
    }
        </div>

        <!-- Todo list -->
        ${
      computed(() => {
        const todos = filteredTodos.value;
        console.log("Rendering todos:", todos);

        if (todos.length === 0) {
          return html`<p class="text-gray-500 text-center py-4">No todos to show</p>`;
        }

        return html`
            <ul class="space-y-2">
              ${html`${
          todos.map((todo) => {
            console.log("Rendering todo:", todo);
            return html`
                  <li class="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      .checked=${todo.completed}
                      on:change="./handlers/toggle-todo.js"
                      data-id=${todo.id}
                    >
                    <span class=${
              todo.completed ? "line-through text-gray-500" : "text-gray-900"
            }>
                      ${todo.text}
                    </span>
                    <button 
                      class="ml-auto text-red-500 hover:text-red-700"
                      on:click="./handlers/delete-todo.js"
                      data-id=${todo.id}
                    >×</button>
                  </li>
                `;
          })
        }`}
            </ul>
          `;
      })
    }

        <!-- Footer -->
        ${
      computed(() =>
        this.todos.value.length > 0
          ? html`
          <div class="mt-4 flex justify-between text-sm text-gray-500">
            <span>${activeCount.value} items left</span>
            ${
            hasCompleted.value
              ? html`
              <button 
                class="text-blue-500 hover:underline"
                on:click="./handlers/clear-completed.js"
              >
                Clear completed
              </button>
            `
              : null
          }
          </div>
        `
          : null
      )
    }
      </div>
    `;
  }

  connectedCallback() {
    this.wrapper.render(() => this.createTemplate());
  }

  disconnectedCallback() {
    this.wrapper.cleanup();
  }

  addTodo(event: Event) {
    event.preventDefault();
    const text = this.newTodoText.value.trim();

    if (text) {
      this.todos.value = [...this.todos.value, {
        id: this.nextId.value++,
        text,
        completed: false,
      }];
      this.newTodoText.value = "";
    }
  }

  toggleTodo(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const id = Number(checkbox.dataset.id);

    this.todos.value = this.todos.value.map((todo) =>
      todo.id === id ? { ...todo, completed: checkbox.checked } : todo
    );
  }

  deleteTodo(event: Event) {
    const button = event.target as HTMLButtonElement;
    const id = Number(button.dataset.id);

    this.todos.value = this.todos.value.filter((todo) => todo.id !== id);
  }

  forceUpdate() {
    this.wrapper.update(() => {
      return this.createTemplate();
    });
  }
}
