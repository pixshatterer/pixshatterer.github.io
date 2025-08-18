import { onMount } from "solid-js";
import { videoStore } from "./stores/videoStore";
import { initializeCastReceiver } from "./services/castService";

export default function App() {
  onMount(() => {
    initializeCastReceiver();
  });

  return (
    <div style="padding:16px">
      <h1 style="font-size:18px">Custom Receiver · Solid</h1>
      <div>
        <div><b>Title:</b> {videoStore.title}</div>
        <div><b>URL:</b> {videoStore.url}</div>
        <div><b>Playing:</b> {videoStore.isPlaying ? "Yes" : "No"}</div>
        <div><b>Current Time:</b> {videoStore.currentTime.toFixed(2)}s</div>
      </div>
    </div>
  );
}