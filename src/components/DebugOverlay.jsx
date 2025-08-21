import { For, createMemo } from "solid-js";
import { videoStore } from "../stores/videoStore";
import "./DebugOverlay.css";

export default function DebugOverlay() {
  // Create reactive computed values for the arrays to ensure proper updates
  const recentMessages = createMemo(() => videoStore.debug.messages.slice(0, 5));
  const recentErrors = createMemo(() => videoStore.debug.errors.slice(0, 3));
  
  // Static timestamp for when the component was created
  const initialTime = import.meta.__APP_VERSION__

  return (
    <div class="debug-overlay">
      <div class="debug-header">
        <span class="debug-title">Cast Receiver Debug - {initialTime}</span>
        <div class="debug-indicators">
          <span class={`debug-indicator ${videoStore.debug.messageCount > 0 ? 'has-data' : ''}`}>
            📨 {videoStore.debug.messageCount}
          </span>
          <span class={`debug-indicator ${videoStore.debug.errorCount > 0 ? 'has-errors' : ''}`}>
            ❌ {videoStore.debug.errorCount}
          </span>
          <span class={`debug-indicator ${videoStore.drm.isConfigured ? 'has-drm' : ''}`}>
            🔒 {videoStore.drm.isConfigured ? 'DRM' : 'No DRM'}
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

          {videoStore.drm.isConfigured && (
            <div class="debug-last-item drm">
              <strong>DRM Status:</strong> Configured
              <div class="drm-details">
                <div><strong>Systems:</strong> {videoStore.drm.systems.join(', ')}</div>
                {videoStore.drm.licenseUrl && (
                  <div><strong>License URL:</strong> {videoStore.drm.licenseUrl.substring(0, 50)}...</div>
                )}
                <div><strong>Headers:</strong> {videoStore.drm.hasHeaders ? 'Yes' : 'No'}</div>
                <div><strong>Configured:</strong> {new Date(videoStore.drm.configuredAt).toLocaleTimeString()}</div>
              </div>
            </div>
          )}

          <div class="debug-list">
            <For each={recentMessages()} fallback={
              <div class="debug-empty">Waiting for Cast messages...</div>
            }>
              {(message, index) => (
                <div class="debug-item">
                  <div class="debug-item-header">
                    <span class="debug-item-type">{message.type}</span>
                    <span class="debug-item-source">{message.source}</span>
                    <span class="debug-item-time">{message.timestamp}</span>
                    <span class="debug-item-index">#{index() + 1}</span>
                  </div>
                  <div class="debug-item-data">
                    <pre>{JSON.stringify(message.data, null, 2)}</pre>
                  </div>
                </div>
              )}
            </For>
            
            {recentErrors().length > 0 && (
              <div class="debug-errors-summary">
                <div class="debug-errors-title">Recent Errors:</div>
                <For each={recentErrors()}>
                  {(error, index) => (
                    <div class="debug-item error">
                      <div class="debug-item-header">
                        <span class="debug-item-type">ERROR</span>
                        <span class="debug-item-time">{error.timestamp}</span>
                        <span class="debug-item-index">#{index() + 1}</span>
                      </div>
                      <div class="debug-item-message">{error.message}</div>
                      {error.data && (
                        <div class="debug-item-data">
                          <pre>{JSON.stringify(error.data, null, 2)}</pre>
                        </div>
                      )}
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
