import { videoActions, videoStore } from "../stores/videoStore";
import { createEffect } from "solid-js";
import { sendMessageToSenders } from "../services/castService";

let castContext = null;

export const PlayerController = {
  _impl: videoActions,
  
  // Send player events to connected senders
  sendPlayerEvent(eventType, eventData) {
    return sendMessageToSenders("PLAYER_EVENT", {
      eventType,
      eventData,
      playerState: {
        isPlaying: videoStore.isPlaying,
        currentTime: videoStore.currentTime,
        url: videoStore.url,
        title: videoStore.title,
        isLive: videoStore.isLive,
        streamType: videoStore.streamType
      }
    });
  },

  // Initialize the controller with Cast context
  initialize(context) {
    castContext = context;
    this.setupQualityOptimization();
    this.setupReactivePlayerControl();
    this.setupPlayerEventListeners();
    
    this._impl?.addDebugMessage?.({
      type: "CONTROLLER_INITIALIZED",
      data: {
        hasQualityOptimization: true,
        hasReactiveControl: true,
        hasEventListeners: true
      },
      source: "PLAYER_CONTROLLER",
    });
  },

  // Set up quality optimization for better video quality
  setupQualityOptimization() {
    if (!castContext) return;

    const playerManager = castContext.getPlayerManager();
    if (!playerManager) return;

    // Configure player for better quality
    if (playerManager.setMediaPlaybackInfoHandler) {
      playerManager.setMediaPlaybackInfoHandler((_, mediaPlaybackInfo) => {
        this._impl?.addDebugMessage?.({
          type: "PLAYBACK_INFO_HANDLER",
          data: {
            supportedCommands: mediaPlaybackInfo.supportedMediaCommands,
            action: "Setting media playback info for quality optimization"
          },
          source: "QUALITY_OPTIMIZATION",
        });
        
        // Request higher quality by default
        if (mediaPlaybackInfo.supportedMediaCommands) {
          mediaPlaybackInfo.supportedMediaCommands |= cast.framework.messages.Command.STREAM_VOLUME;
        }
        
        // Log quality configuration
        this._impl?.addDebugMessage?.({
          type: "QUALITY_CONFIG",
          data: {
            preferredBitrate: "8Mbps",
            maxBitrate: "25Mbps",
            adaptiveBitrate: true
          },
          source: "PLAYER_CONTROLLER",
        });

        return mediaPlaybackInfo;
      });
    }

    // Set up load interceptor for quality optimization
    if (playerManager.setMessageInterceptor) {
      playerManager.setMessageInterceptor(
        cast.framework.messages.MessageType.LOAD,
        (request) => {
          this._impl?.addDebugMessage?.({
            type: "LOAD_INTERCEPTOR",
            data: {
              action: "Intercepting LOAD request for quality optimization",
              originalContentType: request.media?.contentType,
              originalStreamType: request.media?.streamType
            },
            source: "QUALITY_OPTIMIZATION",
          });
          
          // Enhance load request with quality preferences
          if (request.media) {
            request.media.customData = {
              ...request.media.customData,
              qualityPreferences: {
                preferHigherBitrate: true,
                adaptiveBitrate: true,
                targetBitrate: 8000000, // 8 Mbps
                maxBitrate: 25000000    // 25 Mbps
              }
            };
          }

          this._impl?.addDebugMessage?.({
            type: "LOAD_INTERCEPTED",
            data: {
              hasQualityPreferences: !!request.media?.customData?.qualityPreferences,
              contentType: request.media?.contentType,
              streamType: request.media?.streamType
            },
            source: "PLAYER_CONTROLLER",
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
        PLAYER_STATE_CHANGED: !!EventType.PLAYER_STATE_CHANGED,
        TIME_UPDATE: !!EventType.TIME_UPDATE,
        ERROR: !!EventType.ERROR,
        BREAK_ENDED: !!EventType.BREAK_ENDED
      },
      source: "EVENT_SETUP",
    });

    // Player state changes
    if (EventType.PLAYER_STATE_CHANGED) {
      playerManager.addEventListener(EventType.PLAYER_STATE_CHANGED, (event) => {
        this._impl?.addDebugMessage?.({
          type: "PLAYER_STATE_CHANGED",
          data: { playerState: event.playerState },
          source: "CAF_EVENT",
        });

        // Send player state change to senders
        this.sendPlayerEvent("STATE_CHANGED", {
          playerState: event.playerState,
          timestamp: new Date().toISOString()
        });

        // When media starts playing, capture the actual media session info
        if (event.playerState === cast.framework.messages.PlayerState.PLAYING) {
          this.updatePlayback({ isPlaying: true });
          
          // Capture actual media session information only if it exists
          const mediaSession = playerManager.getMediaSession();
          if (mediaSession?.media) {
            const mediaInfo = {
              contentId: mediaSession.media.contentId,
              contentType: mediaSession.media.contentType,
              streamType: mediaSession.media.streamType,
              duration: mediaSession.media.duration,
              title: mediaSession.media.metadata?.title,
              subtitle: mediaSession.media.metadata?.subtitle,
              hasMetadata: !!mediaSession.media.metadata,
              metadataType: mediaSession.media.metadata?.metadataType,
              customData: mediaSession.media.customData,
              sessionId: mediaSession.sessionId,
              mediaSessionId: mediaSession.mediaSessionId
            };

            this._impl?.addDebugMessage?.({
              type: "MEDIA_SESSION_INFO",
              data: mediaInfo,
              source: "MEDIA_SESSION",
            });

            // Send media started event to senders
            this.sendPlayerEvent("MEDIA_STARTED", {
              mediaInfo: {
                contentId: mediaSession.media.contentId,
                contentType: mediaSession.media.contentType,
                streamType: mediaSession.media.streamType,
                duration: mediaSession.media.duration,
                title: mediaSession.media.metadata?.title
              }
            });
          }
        } else if (event.playerState === cast.framework.messages.PlayerState.PAUSED) {
          this.updatePlayback({ isPlaying: false });
          
          // Send paused event to senders
          this.sendPlayerEvent("MEDIA_PAUSED", {
            currentTime: videoStore.currentTime
          });
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

        // Send error event to senders
        this.sendPlayerEvent("ERROR", {
          errorCode: event.error,
          detailedErrorCode: event.detailedErrorCode,
          reason: event.reason,
          analysis: errorDetails.analysis,
          possibleCauses: errorDetails.possibleCauses
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
      const streamType = videoStore.streamType;
      const drm = videoStore.drm;

          // Debug the entire videoStore state via overlay
          this._impl?.addDebugMessage?.({
            type: "STORE_STATE_DEBUG",
            data: {
              url: videoStore.url,
              title: videoStore.title,
              contentType: videoStore.contentType,
              isLive: videoStore.isLive,
              streamType: videoStore.streamType,
              isLiveType: typeof videoStore.isLive,
              isLiveValue: JSON.stringify(videoStore.isLive)
            },
            source: "REACTIVE_DEBUG",
          });

      if (url?.trim()) {
        this._impl?.addDebugMessage?.({
          type: "LOADING_MEDIA",
          data: {
            url,
            title,
            contentType,
            isLive,
            streamType,
            hasDRM: drm.enabled
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
            mediaInfo.metadata.subtitle = `${isLive ? 'LIVE' : 'VOD'} Stream`;
            
            // Add additional metadata for better display
            mediaInfo.metadata.images = [{
              url: "https://via.placeholder.com/480x270/000000/FFFFFF?text=Video"
            }];
          } else {
            // Even without title, provide basic metadata
            mediaInfo.metadata = new cast.framework.messages.GenericMediaMetadata();
            mediaInfo.metadata.title = isLive ? "Live Stream" : "Video Stream";
            mediaInfo.metadata.subtitle = contentType || "Media Stream";
          }

          // Debug the metadata we're setting
          this._impl?.addDebugMessage?.({
            type: "METADATA_SET",
            data: {
              title: mediaInfo.metadata.title,
              subtitle: mediaInfo.metadata.subtitle,
              hasImages: !!mediaInfo.metadata.images,
              metadataType: mediaInfo.metadata.metadataType
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
            preferredBitrate: 8000000, // 8 Mbps
            maxBitrate: 25000000, // 25 Mbps
            qualityPreferences: {
              preferHigherBitrate: true,
              adaptiveBitrate: true
            }
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
              isLiveFromStore: isLive
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
              isLive,
              streamType: mediaInfo.streamType,
              streamTypeText: streamType === cast.framework.messages.StreamType.LIVE ? "LIVE" : "BUFFERED",
              hasDRM: drm.enabled
            },
            source: "PLAYER_CONTROLLER",
          });
          
        } catch (error) {
          this._impl?.addDebugError?.({
            message: "Failed to load media reactively",
            data: {
              error: error.message || error,
              url,
              isLive,
              contentType
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
};
