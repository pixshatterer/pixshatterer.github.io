import { videoActions, videoStore } from "../stores/videoStore";
import { createEffect } from "solid-js";
import { sendMessageToSenders } from "../services/castService";

let castContext = null;

export const PlayerController = {
  _impl: videoActions,

  // Helper function to convert player state to readable string
  getPlayerStateString(playerState) {
    const states = cast.framework.messages.PlayerState;
    switch (playerState) {
      case states.IDLE:
        return "IDLE";
      case states.PLAYING:
        return "PLAYING";
      case states.PAUSED:
        return "PAUSED";
      case states.BUFFERING:
        return "BUFFERING";
      default:
        return `UNKNOWN(${playerState})`;
    }
  },

  // Send player events to connected senders
  sendPlayerEvent(eventType, eventData) {
    const success = sendMessageToSenders("PLAYER_EVENT", {
      eventType,
      eventData,
      playerState: {
        isPlaying: videoStore.isPlaying,
        currentTime: videoStore.currentTime,
        url: videoStore.url,
        title: videoStore.title,
        streamType: videoStore.streamType,
      },
    });

    this._impl?.addDebugMessage?.({
      type: "PLAYER_EVENT_SEND_RESULT",
      data: {
        eventType,
        success,
        timestamp: new Date().toISOString(),
      },
      source: "EVENT_SENDER",
    });

    return success;
  },

  // Get current player state for debugging
  getCurrentPlayerState() {
    if (!castContext) return null;

    const playerManager = castContext.getPlayerManager();
    if (!playerManager) return null;

    const mediaSession = playerManager.getMediaSession();

    const currentState = {
      playerState: playerManager.getPlayerState(),
      playerStateString: this.getPlayerStateString(
        playerManager.getPlayerState()
      ),
      hasMediaSession: !!mediaSession,
      mediaSessionId: mediaSession?.mediaSessionId,
      contentId: mediaSession?.media?.contentId,
      timestamp: new Date().toISOString(),
    };

    this._impl?.addDebugMessage?.({
      type: "CURRENT_PLAYER_STATE_CHECK",
      data: currentState,
      source: "STATE_CHECK",
    });

    return currentState;
  },

  // Initialize the controller with Cast context
  initialize(context) {
    castContext = context;
    this.setupPlayerConfig();
    this.setupReactivePlayerControl();
    this.setupPlayerEventListeners();
    this._impl?.addDebugMessage?.({
      type: "CONTROLLER_INITIALIZED",
      data: {
        hasQualityOptimization: true,
        hasReactiveControl: true,
        hasEventListeners: true,
      },
      source: "PLAYER_CONTROLLER",
    });
  },

  // Set up quality optimization for better video quality
  setupPlayerConfig() {
    if (!castContext) return;

    const playerManager = castContext.getPlayerManager();
    if (!playerManager) return;

    // Configure player for better quality
    const withQuery = (u, q) => {
      const url = new URL(u);
      Object.entries(q).forEach(
        ([k, v]) => v != null && url.searchParams.set(k, String(v))
      );
      return url.toString();
    };

    if (playerManager.setMediaPlaybackInfoHandler) {
      playerManager.setMediaPlaybackInfoHandler((loadReq, cfg) => {
        try {
          const drm = {
            ...(videoStore.customData?.drm || {}),
            ...(loadReq.media?.customData?.drm || {}),
          };

          cfg.licenseUrl = withQuery(drm.licenseUrl || cfg.licenseUrl, {
            contentId: drm.contentId || loadReq.media?.customData?.contentId,
            tenant: drm.tenant,
            sessionId: drm.sessionId,
          });
          return cfg;
        } catch (error) {
          PlayerController._impl?.addDebugError?.({
            message: "Failed to set media playback info",
            data: { error: error.message || error },
            source: "PLAYER_CONTROLLER",
          });
          sendMessageToSenders("PLAYER_ERROR", {
            url: loadReq.media || {},
            customData: loadReq.media?.customData || {},
            drm: loadReq.media?.customData?.drm || {},
            error: error.message || error,
          });
        }
      });
    }
    // Set up load interceptor for quality optimization and entitlement check with retry, timeout, and CORS error reporting
    if (playerManager.setMessageInterceptor) {
      playerManager.setMessageInterceptor(
        cast.framework.messages.MessageType.LOAD,
        async (request) => {
          // Handle Quality Optimization
          if (request.media) {
            request.media.customData = {
              ...request.media.customData,
              qualityPreferences: {
                preferHigherBitrate: true,
                adaptiveBitrate: true,
                targetBitrate: 8000000, // 8 Mbps
                maxBitrate: 25000000, // 25 Mbps
              },
            };
          }

          this._impl?.addDebugMessage?.({
            type: "LOAD_INTERCEPTED",
            data: {
              hasQualityPreferences:
                !!request.media?.customData?.qualityPreferences,
              contentType: request.media?.contentType,
              streamType: request.media?.streamType,
            },
            source: "LOAD_INTERCEPTOR",
          });

          return request;
        }
      );
    }
  },

  // Set up player event listeners
  setupPlayerEventListeners() {
    if (!castContext) return;

    const playerManager = castContext.getPlayerManager();
    if (!playerManager) return;

    const EventType = cast.framework.events.EventType;

    this._impl?.addDebugMessage?.({
      type: "EVENT_LISTENERS_SETUP",
      data: {
        TIME_UPDATE: !!EventType.TIME_UPDATE,
        ERROR: !!EventType.ERROR,
        BREAK_ENDED: !!EventType.BREAK_ENDED,
        SEEK: !!EventType.SEEK,
        PAUSE: !!EventType.PAUSE,
        PLAY: !!EventType.PLAY,
        BUFFERING: !!EventType.BUFFERING,
      },
      source: "EVENT_SETUP",
    });

    // Time updates
    if (EventType.TIME_UPDATE) {
      let lastReportedTime = 0;
      const seekDetectionThreshold = 5; // seconds - if time jumps more than this, consider it a seek

      playerManager.addEventListener(EventType.TIME_UPDATE, (event) => {
        const currentTime = event.currentMediaTime || 0;
        const timeDifference = Math.abs(currentTime - lastReportedTime);

        // Detect seek operations (large time jumps)
        if (lastReportedTime > 0 && timeDifference > seekDetectionThreshold) {
          this._impl?.addDebugMessage?.({
            type: "SEEK_DETECTED_VIA_TIME_UPDATE",
            data: {
              previousTime: lastReportedTime,
              newTime: currentTime,
              timeDifference: timeDifference,
              threshold: seekDetectionThreshold,
            },
            source: "TIME_UPDATE",
          });

          // Send seek event to senders
          this.sendPlayerEvent("SEEK", {
            previousTime: lastReportedTime,
            newTime: currentTime,
            timeDifference: timeDifference,
            detectMethod: "TIME_JUMP",
            timestamp: new Date().toISOString(),
          });
        }

        this.updatePlayback({
          currentTime: currentTime,
        });

        lastReportedTime = currentTime;
      });
    }

    // Seek events (if supported)
    if (EventType.SEEK) {
      playerManager.addEventListener(EventType.SEEK, (event) => {
        this._impl?.addDebugMessage?.({
          type: "SEEK_EVENT_DETECTED",
          data: {
            currentTime: event.currentTime,
            resumeState: event.resumeState,
            timestamp: new Date().toISOString(),
          },
          source: "CAF_EVENT",
        });

        // Send seek event to senders
        this.sendPlayerEvent("SEEK", {
          currentTime: event.currentTime,
          resumeState: event.resumeState,
          detectMethod: "SEEK_EVENT",
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Dedicated PAUSE event listener
    if (EventType.PAUSE) {
      playerManager.addEventListener(EventType.PAUSE, (event) => {
        this._impl?.addDebugMessage?.({
          type: "PAUSE_EVENT_DETECTED",
          data: {
            currentTime: videoStore.currentTime,
            eventType: event.type,
            timestamp: new Date().toISOString(),
          },
          source: "CAF_EVENT",
        });

        this.updatePlayback({ isPlaying: false });

        // Send pause event to senders
        this.sendPlayerEvent("PAUSED", {
          currentTime: videoStore.currentTime,
          detectedBy: "pause_event",
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Dedicated PLAY event listener
    if (EventType.PLAY) {
      playerManager.addEventListener(EventType.PLAY, (event) => {
        this._impl?.addDebugMessage?.({
          type: "PLAY_EVENT_DETECTED",
          data: {
            currentTime: videoStore.currentTime,
            eventType: event.type,
            timestamp: new Date().toISOString(),
          },
          source: "CAF_EVENT",
        });

        this.updatePlayback({ isPlaying: true });

        // Send play/resume event to senders
        this.sendPlayerEvent("RESUMED", {
          currentTime: videoStore.currentTime,
          detectedBy: "play_event",
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Dedicated BUFFERING event listener
    if (EventType.BUFFERING) {
      playerManager.addEventListener(EventType.BUFFERING, (event) => {
        this._impl?.addDebugMessage?.({
          type: "BUFFERING_EVENT_DETECTED",
          data: {
            currentTime: videoStore.currentTime,
            eventType: event.type,
            timestamp: new Date().toISOString(),
          },
          source: "CAF_EVENT",
        });

        // Send buffering event to senders
        this.sendPlayerEvent("BUFFERING", {
          currentTime: videoStore.currentTime,
          detectedBy: "buffering_event",
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Dedicated IDLE event listerner
    if (EventType.IDLE) {
      playerManager.addEventListener(EventType.IDLE, (event) => {
        this._impl?.addDebugMessage?.({
          type: "IDLE_EVENT_DETECTED",
          data: {
            currentTime: videoStore.currentTime,
            eventType: event.type,
            timestamp: new Date().toISOString(),
          },
          source: "CAF_EVENT",
        });
        // Send buffering event to senders
        this.sendPlayerEvent("IDLE", {
          currentTime: videoStore.currentTime,
          detectedBy: "idle_event",
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Error handling with 905 error analysis
    if (EventType.ERROR) {
      playerManager.addEventListener(EventType.ERROR, (event) => {
        const errorDetails = {
          errorCode: event.error,
          detailedErrorCode: event.detailedErrorCode,
          reason: event.reason,
          mediaSessionId: event.mediaSessionId,
          source: "CAF_ERROR",
        };

        // Specific handling for 905 (LOAD_FAILED) errors
        if (event.error === 905 || event.detailedErrorCode === 905) {
          errorDetails.analysis = "LOAD_FAILED (905): Media failed to load";
          errorDetails.possibleCauses = [
            "Invalid or unreachable URL",
            "CORS configuration issues",
            "Unsupported media format/codec",
            "Network connectivity issues",
          ];

          const mediaSession = playerManager.getMediaSession();
          if (mediaSession?.media) {
            errorDetails.mediaInfo = {
              contentId: mediaSession.media.contentId,
              contentType: mediaSession.media.contentType,
              streamType: mediaSession.media.streamType,
            };
          }
        }

        this._impl?.addDebugError?.({
          message: `Player error ${event.error}: ${
            event.detailedErrorCode || "Unknown"
          }`,
          data: errorDetails,
          source: "CAF_ERROR",
        });

        // Send error event to senders
        this.sendPlayerEvent("ERROR", {
          errorCode: event.error,
          detailedErrorCode: event.detailedErrorCode,
          reason: event.reason,
          analysis: errorDetails.analysis,
          possibleCauses: errorDetails.possibleCauses,
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

    // Final debug message to confirm all event listeners are set up
    this._impl?.addDebugMessage?.({
      type: "ALL_EVENT_LISTENERS_COMPLETE",
      data: {
        playerManagerExists: !!playerManager,
        setupComplete: true,
        timestamp: new Date().toISOString(),
      },
      source: "EVENT_SETUP",
    });
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
      const streamType = videoStore.streamType;
      const customData = videoStore.customData;
      const metadata = videoStore.metadata;

      if (url?.trim()) {
        this._impl?.addDebugMessage?.({
          type: "LOADING_MEDIA",
          data: {
            url,
            title,
            contentType,
            streamType,
            customData,
          },
          source: "REACTIVE_CONTROL",
        });

        try {
          // Create media info from store data
          const mediaInfo = new cast.framework.messages.MediaInformation();
          mediaInfo.contentId = url;
          mediaInfo.contentType = contentType || "application/dash+xml";

          // Use streamType from store instead of calculating it here
          mediaInfo.streamType = streamType;

          // Add metadata if available
          if (title) {
            mediaInfo.metadata =
              new cast.framework.messages.GenericMediaMetadata();
            mediaInfo.metadata.title = metadata.title;
            mediaInfo.metadata.subtitle = metadata.subtitle;
          }

          // Debug the metadata we're setting
          this._impl?.addDebugMessage?.({
            type: "METADATA_SET",
            data: {
              title: mediaInfo.metadata.title,
              subtitle: mediaInfo.metadata.subtitle,
              hasImages: !!mediaInfo.metadata.images,
              metadataType: mediaInfo.metadata.metadataType,
            },
            source: "METADATA_DEBUG",
          });

          // Create and configure load request
          const request = new cast.framework.messages.LoadRequestData();
          request.media = mediaInfo;
          request.autoplay = true;

          // Add quality preferences
          request.customData = {
            ...request.customData,
            ...customData,
            preferredBitrate: 8000000, // 8 Mbps
            maxBitrate: 25000000, // 25 Mbps
            qualityPreferences: {
              preferHigherBitrate: true,
              adaptiveBitrate: true,
            },
          };

          // Load the media
          playerManager.load(request);

          // Debug the load completion
          this._impl?.addDebugMessage?.({
            type: "MEDIA_LOADED",
            data: {
              success: true,
              url,
              streamType: mediaInfo.streamType,
            },
            source: "REACTIVE_CONTROL",
          });

          // Log debug message
          this._impl?.addDebugMessage?.({
            type: "REACTIVE_LOAD",
            data: {
              url,
              title,
              contentType,
              streamType: mediaInfo.streamType,
              streamTypeText:
                streamType === cast.framework.messages.StreamType.LIVE
                  ? "LIVE"
                  : "BUFFERED",
            },
            source: "PLAYER_CONTROLLER",
          });
        } catch (error) {
          this._impl?.addDebugError?.({
            message: "Failed to load media reactively",
            data: {
              error: error.message || error,
              url,
              contentType,
            },
            source: "REACTIVE_CONTROL",
          });
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

  loadAsset(assetData) {
    sendMessageToSenders("ID_TO_DITU_CORE", { assetData });
    //return this._impl?.loadStreamById?.(streamId);
  },
};
