export function createTodoHandlers(signals) {
  return {
    addTodo({ event }) {
      event.preventDefault();
      const input = document.querySelector("#todo-input");
      const title = input?.value?.trim();
      if (!title) return;

      signals.todos.value = [
        ...signals.todos.value,
        { id: crypto.randomUUID(), title, done: false },
      ];
      input.value = "";
    },

    toggleTodo({ element }) {
      const id = element.getAttribute("data-id");
      signals.todos.value = signals.todos.value.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      );
    },

    removeTodo({ element }) {
      const id = element.getAttribute("data-id");
      signals.todos.value = signals.todos.value.filter((todo) => todo.id !== id);
    },

    startEdit({ element }) {
      const id = element.getAttribute("data-id");
      signals.editingId.value = id;
      const item = signals.todos.value.find((todo) => todo.id === id);
      signals.editDraft.value = item?.title ?? "";
    },

    updateDraft({ element }) {
      signals.editDraft.value = element.value;
    },

    saveEdit({ event }) {
      event.preventDefault();
      if (!signals.editingId.value) return;

      signals.todos.value = signals.todos.value.map((todo) =>
        todo.id === signals.editingId.value
          ? { ...todo, title: signals.editDraft.value.trim() || todo.title }
          : todo
      );

      signals.editingId.value = null;
      signals.editDraft.value = "";
    },
  };
}
