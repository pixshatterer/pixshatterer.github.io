import { createStore } from "solid-js/store";

export const [videoStore, setVideoStore] = createStore({
  url: "",
  title: "",
  contentType: "",
  isLive: false,
  streamType: null, // Will be set based on isLive value
  isPlaying: false,
  currentTime: 0,
  // DRM status
  drm: {
    isConfigured: false,
    systems: [],
    licenseUrl: null,
    hasHeaders: false,
    configuredAt: null
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
  loadStream({ url, title, contentType, isLive, streamType }) {
    setVideoStore({ 
      url, 
      title, 
      contentType,
      isLive,
      streamType // streamType is now passed from the caller
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
      streamType: null,
      drm: {
        isConfigured: false,
        systems: [],
        licenseUrl: null,
        hasHeaders: false,
        configuredAt: null
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
  },
  setDrmStatus(drmInfo) {
    setVideoStore('drm', {
      isConfigured: true,
      systems: drmInfo.systems || [],
      licenseUrl: drmInfo.licenseUrl || null,
      hasHeaders: drmInfo.hasHeaders || false,
      configuredAt: new Date().toISOString()
    });
  },
  clearDrmStatus() {
    setVideoStore('drm', {
      isConfigured: false,
      systems: [],
      licenseUrl: null,
      hasHeaders: false,
      configuredAt: null
    });
  }
};
