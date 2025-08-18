import { videoActions, videoStore } from "../stores/videoStore";
import { createEffect } from "solid-js";

let castContext = null;

export const PlayerController = {
  _impl: videoActions,
  
  // Initialize the controller with Cast context
  initialize(context) {
    castContext = context;
    this.setupReactivePlayerControl();
    this.setupPlayerEventListeners();
    console.log("✅ PlayerController initialized with reactive control and event listeners");
  },

  // Set up player event listeners
  setupPlayerEventListeners() {
    if (!castContext) return;

    const playerManager = castContext.getPlayerManager();
    if (!playerManager) return;

    const EventType = cast.framework.events.EventType;

    console.log("Setting up player event listeners:", {
      PLAYER_STATE_CHANGED: !!EventType.PLAYER_STATE_CHANGED,
      TIME_UPDATE: !!EventType.TIME_UPDATE,
      ERROR: !!EventType.ERROR,
    });

    // Player state changes
    if (EventType.PLAYER_STATE_CHANGED) {
      playerManager.addEventListener(EventType.PLAYER_STATE_CHANGED, (event) => {
        console.log("Player state changed:", event.playerState);

        this._impl?.addDebugMessage?.({
          type: "PLAYER_STATE_CHANGED",
          data: { playerState: event.playerState },
          source: "CAF_EVENT",
        });

        if (event.playerState === cast.framework.messages.PlayerState.PLAYING) {
          this.updatePlayback({ isPlaying: true });
        } else if (event.playerState === cast.framework.messages.PlayerState.PAUSED) {
          this.updatePlayback({ isPlaying: false });
        }
      });
    }

    // Time updates
    if (EventType.TIME_UPDATE) {
      playerManager.addEventListener(EventType.TIME_UPDATE, (event) => {
        this.updatePlayback({
          currentTime: event.currentMediaTime || 0,
        });
      });
    }

    // Error handling with 905 error analysis
    if (EventType.ERROR) {
      playerManager.addEventListener(EventType.ERROR, (event) => {
        console.error("Player error:", event);
        
        const errorDetails = {
          errorCode: event.error,
          detailedErrorCode: event.detailedErrorCode,
          reason: event.reason,
          mediaSessionId: event.mediaSessionId,
          source: "CAF_ERROR"
        };

        // Specific handling for 905 (LOAD_FAILED) errors
        if (event.error === 905 || event.detailedErrorCode === 905) {
          errorDetails.analysis = "LOAD_FAILED (905): Media failed to load";
          errorDetails.possibleCauses = [
            "Invalid or unreachable URL",
            "CORS configuration issues", 
            "DRM license server problems",
            "Unsupported media format/codec",
            "Network connectivity issues"
          ];
          
          const mediaSession = playerManager.getMediaSession();
          if (mediaSession?.media) {
            errorDetails.mediaInfo = {
              contentId: mediaSession.media.contentId,
              contentType: mediaSession.media.contentType,
              streamType: mediaSession.media.streamType,
              hasDRM: !!mediaSession.media.customData?.drm
            };
          }
        }

        this._impl?.addDebugError?.({
          message: `Player error ${event.error}: ${event.detailedErrorCode || 'Unknown'}`,
          data: errorDetails,
          source: "CAF_ERROR",
        });
      });
    }

    // Other player events
    if (EventType.BREAK_ENDED) {
      playerManager.addEventListener(EventType.BREAK_ENDED, (event) => {
        this._impl?.addDebugMessage?.({
          type: "BREAK_ENDED",
          data: event,
          source: "CAF_EVENT",
        });
      });
    }
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
