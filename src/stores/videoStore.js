import { createStore } from "solid-js/store";

export const [videoStore, setVideoStore] = createStore({
  url: "",
  title: "",
  contentType: "",
  isLive: false,
  isPlaying: false,
  currentTime: 0,
  // DRM configuration
  drm: {
    licenseUrl: "",
    keySystem: "", // e.g., "com.widevine.alpha", "com.microsoft.playready"
    headers: {},   // Additional headers for license requests
    enabled: false
  },
  // Debug information
  debug: {
    messages: [],
    errors: [],
    lastMessage: null,
    lastError: null,
    messageCount: 0,
    errorCount: 0
  }
});

export const videoActions = {
  loadStream({ url, title, contentType, isLive, drm }) {
    const drmConfig = drm ? {
      licenseUrl: drm.licenseUrl || "",
      keySystem: drm.keySystem || "com.widevine.alpha",
      headers: drm.headers || {},
      enabled: !!(drm.licenseUrl)
    } : {
      licenseUrl: "",
      keySystem: "",
      headers: {},
      enabled: false
    };

    setVideoStore({ 
      url, 
      title, 
      contentType,
      isLive,
      drm: drmConfig
    });
  },
  updatePlayback(partial) {
    setVideoStore(partial);
  },
  reset() {
    setVideoStore({
      url: "",
      title: "",
      contentType: "",
      isPlaying: false,
      currentTime: 0,
      drm: {
        licenseUrl: "",
        keySystem: "",
        headers: {},
        enabled: false
      },
      debug: {
        messages: [],
        errors: [],
        lastMessage: null,
        lastError: null,
        messageCount: 0,
        errorCount: 0
      }
    });
  },
  addDebugMessage(message) {
    const timestamp = new Date().toLocaleTimeString();
    const messageWithTime = { ...message, timestamp };
    
    setVideoStore('debug', 'messages', prev => [messageWithTime, ...prev].slice(0, 5)); // Keep last 5
    setVideoStore('debug', 'lastMessage', messageWithTime);
    setVideoStore('debug', 'messageCount', prev => prev + 1);
  },
  addDebugError(error) {
    const timestamp = new Date().toLocaleTimeString();
    const errorWithTime = { 
      message: error.message || error,
      stack: error.stack,
      timestamp 
    };
    
    setVideoStore('debug', 'errors', prev => [errorWithTime, ...prev].slice(0, 5)); // Keep last 5
    setVideoStore('debug', 'lastError', errorWithTime);
    setVideoStore('debug', 'errorCount', prev => prev + 1);
  },
  clearDebugMessages() {
    setVideoStore('debug', 'messages', []);
    setVideoStore('debug', 'messageCount', 0);
  },
  clearDebugErrors() {
    setVideoStore('debug', 'errors', []);
    setVideoStore('debug', 'errorCount', 0);
  }
};
