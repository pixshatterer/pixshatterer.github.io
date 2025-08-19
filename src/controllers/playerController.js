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
      case states.IDLE: return "IDLE";
      case states.PLAYING: return "PLAYING";
      case states.PAUSED: return "PAUSED";
      case states.BUFFERING: return "BUFFERING";
      default: return `UNKNOWN(${playerState})`;
    }
  },

  // Send player events to connected senders
  sendPlayerEvent(eventType, eventData) {
    this._impl?.addDebugMessage?.({
      type: "SENDING_PLAYER_EVENT",
      data: {
        eventType,
        eventData,
        hasData: !!eventData,
        timestamp: new Date().toISOString()
      },
      source: "EVENT_SENDER",
    });

    const success = sendMessageToSenders("PLAYER_EVENT", {
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

    this._impl?.addDebugMessage?.({
      type: "PLAYER_EVENT_SEND_RESULT",
      data: {
        eventType,
        success,
        timestamp: new Date().toISOString()
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
      playerStateString: this.getPlayerStateString(playerManager.getPlayerState()),
      hasMediaSession: !!mediaSession,
      mediaSessionId: mediaSession?.mediaSessionId,
      contentId: mediaSession?.media?.contentId,
      timestamp: new Date().toISOString()
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
        BREAK_ENDED: !!EventType.BREAK_ENDED,
        SEEK: !!EventType.SEEK
      },
      source: "EVENT_SETUP",
    });

    // Player state changes
    if (EventType.PLAYER_STATE_CHANGED) {
      this._impl?.addDebugMessage?.({
        type: "PLAYER_STATE_LISTENER_ADDED",
        data: { 
          eventTypeExists: !!EventType.PLAYER_STATE_CHANGED,
          playerManagerExists: !!playerManager,
          timestamp: new Date().toISOString()
        },
        source: "EVENT_SETUP",
      });

      playerManager.addEventListener(EventType.PLAYER_STATE_CHANGED, (event) => {
        // Enhanced debugging for all state changes
        this._impl?.addDebugMessage?.({
          type: "PLAYER_STATE_CHANGED",
          data: { 
            playerState: event.playerState,
            playerStateString: this.getPlayerStateString(event.playerState),
            timestamp: new Date().toISOString(),
            eventObject: {
              type: event.type,
              target: !!event.target
            }
          },
          source: "CAF_EVENT",
        });

        // Send player state change to senders
        this.sendPlayerEvent("STATE_CHANGED", {
          playerState: event.playerState,
          playerStateString: this.getPlayerStateString(event.playerState),
          timestamp: new Date().toISOString()
        });

        // When media starts playing, capture the actual media session info
        if (event.playerState === cast.framework.messages.PlayerState.PLAYING) {
          this._impl?.addDebugMessage?.({
            type: "PLAYING_STATE_DETECTED",
            data: { action: "Setting isPlaying to true" },
            source: "STATE_HANDLER",
          });
          
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
          this._impl?.addDebugMessage?.({
            type: "PAUSED_STATE_DETECTED",
            data: { 
              action: "Setting isPlaying to false",
              currentTime: videoStore.currentTime,
              pauseEventReceived: true
            },
            source: "STATE_HANDLER",
          });
          
          this.updatePlayback({ isPlaying: false });
          
          // Send paused event to senders
          this.sendPlayerEvent("MEDIA_PAUSED", {
            currentTime: videoStore.currentTime,
            timestamp: new Date().toISOString()
          });
          
          this._impl?.addDebugMessage?.({
            type: "PAUSE_EVENT_SENT_TO_SENDER",
            data: { 
              currentTime: videoStore.currentTime,
              success: true
            },
            source: "STATE_HANDLER",
          });
        } else {
          // Log any other state changes
          this._impl?.addDebugMessage?.({
            type: "OTHER_STATE_CHANGE",
            data: { 
              playerState: event.playerState,
              playerStateString: this.getPlayerStateString(event.playerState)
            },
            source: "STATE_HANDLER",
          });
        }
      });
    }

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
              threshold: seekDetectionThreshold
            },
            source: "TIME_UPDATE",
          });

          // Send seek event to senders
          this.sendPlayerEvent("SEEK", {
            previousTime: lastReportedTime,
            newTime: currentTime,
            timeDifference: timeDifference,
            detectMethod: "TIME_JUMP",
            timestamp: new Date().toISOString()
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
            timestamp: new Date().toISOString()
          },
          source: "CAF_EVENT",
        });

        // Send seek event to senders
        this.sendPlayerEvent("SEEK", {
          currentTime: event.currentTime,
          resumeState: event.resumeState,
          detectMethod: "SEEK_EVENT",
          timestamp: new Date().toISOString()
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

    // Final debug message to confirm all event listeners are set up
    this._impl?.addDebugMessage?.({
      type: "ALL_EVENT_LISTENERS_COMPLETE",
      data: {
        playerManagerExists: !!playerManager,
        setupComplete: true,
        timestamp: new Date().toISOString()
      },
      source: "EVENT_SETUP",
    });

    // Set up periodic state checking as fallback for unreliable events
    let lastKnownState = null;
    setInterval(() => {
      if (playerManager) {
        const currentState = playerManager.getPlayerState();
        if (currentState !== lastKnownState) {
          this._impl?.addDebugMessage?.({
            type: "STATE_CHANGE_DETECTED_BY_POLLING",
            data: {
              previousState: lastKnownState,
              previousStateString: lastKnownState ? this.getPlayerStateString(lastKnownState) : "null",
              currentState: currentState,
              currentStateString: this.getPlayerStateString(currentState),
              timestamp: new Date().toISOString()
            },
            source: "POLLING_FALLBACK",
          });

          // Since events aren't firing reliably, use polling to send notifications
          if (lastKnownState !== null) { // Skip first state detection
            // Handle pause/play state changes
            if (currentState === cast.framework.messages.PlayerState.PAUSED && 
                lastKnownState === cast.framework.messages.PlayerState.PLAYING) {
              this.sendPlayerEvent("PAUSED", {
                state: currentState,
                stateString: this.getPlayerStateString(currentState),
                detectedBy: "polling",
                timestamp: new Date().toISOString()
              });
              this.updatePlayback({ isPlaying: false });
            } else if (currentState === cast.framework.messages.PlayerState.PLAYING && 
                       lastKnownState === cast.framework.messages.PlayerState.PAUSED) {
              this.sendPlayerEvent("RESUMED", {
                state: currentState,
                stateString: this.getPlayerStateString(currentState),
                detectedBy: "polling",
                timestamp: new Date().toISOString()
              });
              this.updatePlayback({ isPlaying: true });
            } else if (currentState === cast.framework.messages.PlayerState.BUFFERING) {
              this.sendPlayerEvent("BUFFERING", {
                state: currentState,
                stateString: this.getPlayerStateString(currentState),
                detectedBy: "polling",
                timestamp: new Date().toISOString()
              });
            }
          }
          
          lastKnownState = currentState;
        }
      }
    }, 500); // Check every 500ms for more responsive detection
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
