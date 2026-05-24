import { AsyncLoaderContext, createSignal } from "@async/framework-v0";
import { Counter } from "./Counter.tsx";

export function onUpdate(context: AsyncLoaderContext<string>) {
  // console.log("App.module", context.module);
  console.log("App.onUpdate", context.value);
}

// original function component
export function App() {
  console.log("App.tsx");
  const [name, setName] = createSignal("World");

  return (
    <div
      class="min-h-screen bg-gray-100 py-8 px-4"
      on:update="App.tsx, Counter.tsx"
    >
      <div class="max-w-3xl mx-auto flex flex-col gap-8">
        <div class="bg-white rounded-lg shadow-md p-6">
          <h1 class="text-3xl font-bold text-gray-800 mb-4">Hello {name}</h1>
          <input
            type="text"
            value={name()}
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your name"
            onInput={(e) => {
              if (e.target instanceof HTMLInputElement) {
                setName(e.target.value);
                // TODO: refactor this to use context/slack to use loader/handlers correctly
                const success = globalThis.framework.loader.dispatch(
                  "update",
                  e.target.value,
                );
                if (!success) {
                  console.error("Failed to dispatch update event");
                }
              }
            }}
          />
        </div>

        <Counter />
      </div>
    </div>
  );
}

// TODO: Not sure if this style of code splitting is a good idea
// ------------------
// export function App(this) {
//   // set this to parent scope
//   const scope = App_mount.call(this);
//   // set this to scope
//   const handlers = App_handlers.call(scope, scope);
//   // set this to scope
//   return App_render.call(scope, scope, handlers);
// }

// handlers for the component once mounted
// export function App_handlers(this, scope) {
//   return {
//     onInput: (e) => {
//       console.log("App_mount.onInput", this, scope);
//       if (e.target instanceof HTMLInputElement) {
//         // refactor this to use scope
//         this.setName(e.target.value);
//         const success = globalThis.framework.loader.dispatch(
//           "update",
//           e.target.value
//         );
//         if (!success) {
//           console.error("Failed to dispatch update event");
//         }
//       }
//     },
//   };
// }

// mount the component once
// export function App_mount() {
//   // refactor signal to simple object
//   const nameSig = signal("World");
//   // const [name, setName, nameSig] = createSignal("World");

//   return {
//     name: nameSig.get,
//     setName: nameSig.set,
//     nameSig,
//   };
// }

// render the component multiple times
// export function App_render(scope, handlers) {
//   return (
//     <div
//       class="min-h-screen bg-gray-100 py-8 px-4"
//       on:update="App.tsx, Counter.tsx"
//     >
//       <div class="max-w-3xl mx-auto space-y-8">
//         <div class="bg-white rounded-lg shadow-md p-6">
//           <h1 class="text-3xl font-bold text-gray-800 mb-4">
//             Hello {scope.nameSig}
//           </h1>
//           <input
//             type="text"
//             value={scope.name()}
//             class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Enter your name"
//             onInput={handlers.onInput}
//           />
//         </div>

//         <Counter />
//       </div>
//     </div>
//   );
// }
// ------------------
