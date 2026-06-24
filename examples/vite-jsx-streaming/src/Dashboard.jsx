/** @jsxImportSource @async/framework/jsx/runtime */
import {
  Reveal,
  Suspense,
  component,
  signal
} from "@async/framework/jsx";

const count = signal(0);
const profile = signal(loadProfile, { stream: "default" });
const timeline = signal(loadTimeline, { stream: "default" });

export default component(() => (
  <main data-async-id="dashboard">
    <button type="button" data-async-id="increment" onClick={() => count.value = 1}>
      Select sample
    </button>
    <strong data-async-id="count">{count}</strong>
    <Reveal order="forwards" tail="collapsed">
      <Suspense id="profile" value={profile} fallback={<p>Profile fallback</p>}>
        <section data-async-id="profile">{profile.value.name}</section>
      </Suspense>
      <Suspense id="timeline" value={timeline} fallback={<p>Timeline fallback</p>}>
        <section data-async-id="timeline">{timeline.value.latest}</section>
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
