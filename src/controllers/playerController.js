import { videoActions, videoStore } from "../stores/videoStore";
import { createEffect } from "solid-js";

let castContext = null;

export const PlayerController = {
  _impl: videoActions,
  
  // Initialize the controller with Cast context
  initialize(context) {
    castContext = context;
    this.setupReactivePlayerControl();
    console.log("✅ PlayerController initialized with reactive control");
  },

  // Set up reactive effect to control Cast player based on store changes
  setupReactivePlayerControl() {
    if (!castContext) return;

    createEffect(() => {
      const playerManager = castContext.getPlayerManager();
      if (!playerManager) return;

      // Watch for URL changes and automatically load new media
      const url = videoStore.url;
      const title = videoStore.title;
      const contentType = videoStore.contentType;
      const isLive = videoStore.isLive;
      const drm = videoStore.drm;

      if (url?.trim()) {
        console.log("🔄 PlayerController: Video store changed - loading media:", {
          url,
          title,
          contentType,
          isLive,
          hasDRM: drm.enabled
        });

        try {
          // Create media info from store data
          const mediaInfo = new cast.framework.messages.MediaInformation();
          mediaInfo.contentId = url;
          mediaInfo.contentType = contentType || "application/dash+xml";
          mediaInfo.streamType = isLive 
            ? cast.framework.messages.StreamType.LIVE 
            : cast.framework.messages.StreamType.BUFFERED;

          // Add DRM configuration if enabled
          if (drm.enabled && drm.licenseUrl) {
            const drmConfig = {};
            if (drm.keySystem === "com.widevine.alpha" || !drm.keySystem) {
              drmConfig.widevine = {
                licenseUrl: drm.licenseUrl,
                headers: drm.headers || {}
              };
            }
            
            if (Object.keys(drmConfig).length > 0) {
              mediaInfo.customData = {
                ...mediaInfo.customData,
                drm: drmConfig
              };
            }
          }

          // Add metadata if available
          if (title) {
            mediaInfo.metadata = new cast.framework.messages.GenericMediaMetadata();
            mediaInfo.metadata.title = title;
          }

          // Create and configure load request
          const request = new cast.framework.messages.LoadRequestData();
          request.media = mediaInfo;
          request.autoplay = true;

          // Add quality preferences
          request.customData = {
            ...request.customData,
            preferredBitrate: 8000000, // 8 Mbps
            maxBitrate: 25000000, // 25 Mbps
            qualityPreferences: {
              preferHigherBitrate: true,
              adaptiveBitrate: true
            }
          };

          // Load the media
          playerManager.load(request);
          
          console.log("✅ PlayerController: Media loaded reactively");
          
          // Log debug message
          this._impl?.addDebugMessage?.({
            type: "REACTIVE_LOAD",
            data: {
              url,
              title,
              contentType,
              isLive,
              hasDRM: drm.enabled
            },
            source: "PLAYER_CONTROLLER",
          });
          
        } catch (error) {
          console.error("❌ PlayerController: Failed to load media:", error);
          this._impl?.addDebugError?.(error);
        }
      }
    });
  },

  use(adapter) {
    if (adapter && typeof adapter === "object") this._impl = adapter;
    return this;
  },
  
  loadStream(payload) {
    return this._impl?.loadStream?.(payload);
  },
  
  updatePlayback(partial) {
    return this._impl?.updatePlayback?.(partial);
  },
  
  reset() {
    return this._impl?.reset?.();
  },
};
