import { onMount, createSignal } from "solid-js";
import "./App.css";
import "./styles/cast-receiver.css";
import { videoStore } from "./stores/videoStore";
import { initializeCastReceiver, castReady, senderConnected } from "./services/castService";
import { testUtils } from "./utils/testUtils";

export default function App() {
  const [error, setError] = createSignal("");

  onMount(async () => {
    try {
      await initializeCastReceiver();
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
    <div class="app-container">
      <h1 class="app-title">Custom Receiver · Solid</h1>
      
      {error() && (
        <div class="error-message">
          <strong>Error:</strong> {error()}
        </div>
      )}
      
      <div class="status-section">
        <div class={`status-item ${castReady() ? 'status-ready' : 'status-pending'}`}>
          Cast Ready: {castReady() ? "✓" : "⏳"}
        </div>
        <div class={`status-item ${senderConnected() ? 'status-connected' : 'status-disconnected'}`}>
          Sender Connected: {senderConnected() ? "✓" : "✗"}
        </div>
      </div>
      
      <div class="video-info">
        <div class="video-info-item">
          <span class="video-info-label">Title:</span>
          <span class="video-info-value">{videoStore.title || "N/A"}</span>
        </div>
        <div class="video-info-item">
          <span class="video-info-label">URL:</span>
          <span class="video-info-value">{videoStore.url || "N/A"}</span>
        </div>
        <div class="video-info-item">
          <span class="video-info-label">Playing:</span>
          <span class="video-info-value">{videoStore.isPlaying ? "Yes" : "No"}</span>
        </div>
        <div class="video-info-item">
          <span class="video-info-label">Current Time:</span>
          <span class="video-info-value">{videoStore.currentTime.toFixed(2)}s</span>
        </div>
        <div class="video-info-item">
          <span class="video-info-label">DRM Protected:</span>
          <span class={`video-info-value ${videoStore.drm.enabled ? 'drm-enabled' : 'drm-disabled'}`}>
            {videoStore.drm.enabled ? "Yes" : "No"}
          </span>
        </div>
        {videoStore.drm.enabled && (
          <>
            <div class="video-info-item">
              <span class="video-info-label">Key System:</span>
              <span class="video-info-value">{videoStore.drm.keySystem || "N/A"}</span>
            </div>
            <div class="video-info-item">
              <span class="video-info-label">License URL:</span>
              <span class="video-info-value license-url">{videoStore.drm.licenseUrl || "N/A"}</span>
            </div>
          </>
        )}
      </div>

      <div class="developer-info">
        <div class="developer-info-title">Developer Info:</div>
        <div class="developer-info-item">• Open browser console to see detailed logs</div>
        <div class="developer-info-item">• Use <code>window.testUtils.logCastState()</code> to check Cast state</div>
        <div class="developer-info-item">• Use <code>window.testUtils.simulateLoadStream()</code> to test loading</div>
        <div class="developer-info-item">• Use <code>window.testUtils.simulateLoadDRMStream()</code> to test DRM content</div>
      </div>
    </div>
  );
}