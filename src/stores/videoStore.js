import { createStore } from "solid-js/store";

export const [videoStore, setVideoStore] = createStore({
  url: "",
  title: "",
  contentType: "",
  isPlaying: false,
  currentTime: 0,
  // DRM configuration
  drm: {
    licenseUrl: "",
    keySystem: "", // e.g., "com.widevine.alpha", "com.microsoft.playready"
    headers: {},   // Additional headers for license requests
    enabled: false
  },
});

export const videoActions = {
  loadStream({ url, title, contentType, drm }) {
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
    });
  },
};
