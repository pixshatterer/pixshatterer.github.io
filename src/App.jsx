import { onMount, createSignal } from "solid-js";
import "./App.css";
import { videoStore } from "./stores/videoStore";
import { initializeCastReceiver, castReady, senderConnected } from "./services/castService";
import { testUtils } from "./utils/testUtils";

export default function App() {
  const [error, setError] = createSignal("");

  onMount(() => {
    try {
      initializeCastReceiver();
      setError("");
      console.log("✅ Cast receiver app loaded successfully");
      console.log("🔧 Test utilities available as window.testUtils or use testUtils in console");
      testUtils.logCastState();
    } catch (e) {
      console.error("Failed to initialize Cast receiver:", e);
      setError(e.message);
    }
  });

  return (
    <div style="padding:16px">
      <h1 style="font-size:18px">Custom Receiver · Solid</h1>
      
      {error() && (
        <div style="color: red; margin-bottom: 16px; padding: 8px; border: 1px solid red; border-radius: 4px;">
          <strong>Error:</strong> {error()}
        </div>
      )}
      
      <div style="margin-bottom: 16px;">
        <div style={`color: ${castReady() ? 'green' : 'orange'}`}>
          Cast Ready: {castReady() ? "✓" : "⏳"}
        </div>
        <div style={`color: ${senderConnected() ? 'green' : 'gray'}`}>
          Sender Connected: {senderConnected() ? "✓" : "✗"}
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div><b>Title:</b> {videoStore.title || "N/A"}</div>
        <div><b>URL:</b> {videoStore.url || "N/A"}</div>
        <div><b>Playing:</b> {videoStore.isPlaying ? "Yes" : "No"}</div>
        <div><b>Current Time:</b> {videoStore.currentTime.toFixed(2)}s</div>
      </div>

      <div style="margin-top: 20px; padding: 12px; background: #333; border-radius: 4px; font-size: 12px;">
        <div style="margin-bottom: 8px;"><strong>Developer Info:</strong></div>
        <div>• Open browser console to see detailed logs</div>
        <div>• Use <code>window.testUtils.logCastState()</code> to check Cast state</div>
        <div>• Use <code>window.testUtils.simulateLoadStream()</code> to test loading</div>
      </div>
    </div>
  );
}