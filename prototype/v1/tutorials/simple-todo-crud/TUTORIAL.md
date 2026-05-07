# Tutorial 1: Simple Todo App (CRUD)

This tutorial builds a complete CRUD todo app using `createAsyncFramework` and local handlers.

## What you will build

- Add todos
- Toggle completion
- Edit title inline
- Delete todos
- Render list + counts

Completed app files are in `./completed`.

## Step 1) Create the HTML shell

Create `index.html` with a root container and module entrypoint:

```html
<div id="app" data-container></div>
<script type="module" src="./main.js"></script>
```

## Step 2) Define state + render function

In `main.js` create:

- local state object
- `render()` that writes DOM with `on:<event>` attributes
- helper to generate list items

## Step 3) Add CRUD handlers

In `handlers.js` add:

- `addTodo`
- `toggleTodo`
- `removeTodo`
- `startEdit`
- `saveEdit`
- `updateDraft`

Each handler updates state then calls `render()`.

## Step 4) Register handlers and start framework

In `main.js`:

```js
framework.handlers.registerHandlers({
  "todo/add": handlers.addTodo,
  "todo/toggle": handlers.toggleTodo,
  // ...
});
framework.start();
render();
```

## Step 5) Run it

Serve the repo and open:

`prototype/async-framework-v1/tutorials/simple-todo-crud/completed/index.html`
