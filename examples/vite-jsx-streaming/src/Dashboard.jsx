/** @jsxImportSource @async/framework/jsx/buildtime */
import {
  Reveal,
  Suspense,
  component,
  signal
} from "@async/framework/jsx/buildtime";

const count = signal(0);
const profile = signal(loadProfile, { stream: "default" });
const timeline = signal(loadTimeline, { stream: "default" });

// The optimizer profile lowers this intent to the inline command plan
// [["setSignal", "count", ["constant", 1]]] (see streaming-profile.json).
function selectSample() {
  return 1;
}

// This module declares intent only. The @async/framework/vite plugin replaces
// it with a virtual bootstrap module that exports { plan, report,
// startAsyncFramework }; the render function below is never executed at
// runtime in the current build profile.
export default component(() => (
  <main data-async-id="dashboard">
    <button type="button" data-async-id="increment" onClick={selectSample}>
      Select sample
    </button>
    <strong data-async-id="count">{count}</strong>
    <Reveal order="forwards" tail="collapsed">
      <Suspense id="profile" value={profile} fallback={<p>Profile fallback</p>}>
        <section data-async-id="profile">{profile}</section>
      </Suspense>
      <Suspense id="timeline" value={timeline} fallback={<p>Timeline fallback</p>}>
        <section data-async-id="timeline">{timeline}</section>
      </Suspense>
    </Reveal>
  </main>
));

async function loadProfile() {
  return {
    name: "Ada Lovelace"
  };
}

async function loadTimeline() {
  return {
    latest: "Boundary patch ready"
  };
}
