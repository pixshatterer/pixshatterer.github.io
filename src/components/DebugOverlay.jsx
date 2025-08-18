import { For } from "solid-js";
import { videoStore } from "../stores/videoStore";
import "./DebugOverlay.css";

export default function DebugOverlay() {
  return (
    <div class="debug-overlay">
      <div class="debug-header">
        <span class="debug-title">Cast Receiver Debug</span>
        <div class="debug-indicators">
          <span class={`debug-indicator ${videoStore.debug.messageCount > 0 ? 'has-data' : ''}`}>
            📨 {videoStore.debug.messageCount}
          </span>
          <span class={`debug-indicator ${videoStore.debug.errorCount > 0 ? 'has-errors' : ''}`}>
            ❌ {videoStore.debug.errorCount}
          </span>
        </div>
      </div>

      <div class="debug-content">
        <div class="debug-section">
          <div class="debug-section-header">
            <h4>Latest Cast Activity</h4>
          </div>
          
          {videoStore.debug.lastMessage && (
            <div class="debug-last-item">
              <strong>Latest Message:</strong> {videoStore.debug.lastMessage.type} 
              <span class="debug-timestamp">({videoStore.debug.lastMessage.timestamp})</span>
            </div>
          )}
          
          {videoStore.debug.lastError && (
            <div class="debug-last-item error">
              <strong>Latest Error:</strong> {videoStore.debug.lastError.message}
              <span class="debug-timestamp">({videoStore.debug.lastError.timestamp})</span>
            </div>
          )}

          <div class="debug-list">
            <For each={videoStore.debug.messages.slice(0, 10)} fallback={
              <div class="debug-empty">Waiting for Cast messages...</div>
            }>
              {(message) => (
                <div class="debug-item">
                  <div class="debug-item-header">
                    <span class="debug-item-type">{message.type}</span>
                    <span class="debug-item-source">{message.source}</span>
                    <span class="debug-item-time">{message.timestamp}</span>
                  </div>
                  <div class="debug-item-data">
                    <pre>{JSON.stringify(message.data, null, 2)}</pre>
                  </div>
                </div>
              )}
            </For>
            
            {videoStore.debug.errors.length > 0 && (
              <div class="debug-errors-summary">
                <div class="debug-errors-title">Recent Errors:</div>
                <For each={videoStore.debug.errors.slice(0, 3)}>
                  {(error) => (
                    <div class="debug-item error">
                      <div class="debug-item-header">
                        <span class="debug-item-type">ERROR</span>
                        <span class="debug-item-time">{error.timestamp}</span>
                      </div>
                      <div class="debug-item-message">{error.message}</div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
