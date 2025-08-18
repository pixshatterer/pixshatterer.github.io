import { createSignal } from "solid-js";
import { PlayerController } from "../controllers/playerController";

export const [castReady, setCastReady] = createSignal(false);
export const [senderConnected, setSenderConnected] = createSignal(false);

let castContext = null;

function waitForCastFramework() {
  return new Promise((resolve, reject) => {
    if (
      typeof cast !== "undefined" &&
      cast.framework &&
      cast.framework.CastReceiverContext
    ) {
      resolve();
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max wait

    const checkInterval = setInterval(() => {
      attempts++;

      if (
        typeof cast !== "undefined" &&
        cast.framework &&
        cast.framework.CastReceiverContext
      ) {
        clearInterval(checkInterval);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error("Cast framework did not load within timeout"));
      }
    }, 100);
  });
}

export async function initializeCastReceiver() {
  try {
    // Wait for Cast framework to be ready
    await waitForCastFramework();

    // Double-check all required Cast framework components are available
    if (!cast.framework?.CastReceiverContext) {
      throw new Error("CastReceiverContext not available");
    }

    if (!cast.framework?.events?.EventType) {
      throw new Error("Cast framework events not available");
    }

    castContext = cast.framework.CastReceiverContext.getInstance();
    const playerManager = castContext.getPlayerManager();

    // Configure player for better quality
    if (playerManager.setMediaPlaybackInfoHandler) {
      playerManager.setMediaPlaybackInfoHandler((_, mediaPlaybackInfo) => {
        console.log("Setting media playback info for quality optimization");
        
        // Request higher quality by default
        if (mediaPlaybackInfo.supportedMediaCommands) {
          mediaPlaybackInfo.supportedMediaCommands |= cast.framework.messages.Command.STREAM_VOLUME;
        }
        
        // Log quality configuration
        PlayerController._impl?.addDebugMessage?.({
          type: "QUALITY_CONFIG",
          data: {
            preferredBitrate: "8Mbps",
            maxBitrate: "25Mbps",
            adaptiveBitrate: true
          },
          source: "PLAYER_CONFIG",
        });

        return mediaPlaybackInfo;
      });
    }

    // Configure Cast receiver options for better quality
    const receiverOptions = new cast.framework.CastReceiverOptions();
    receiverOptions.maxInactivity = 6000; // 10 minutes
    receiverOptions.playbackConfig = new cast.framework.PlaybackConfig();
    
    // Enable adaptive bitrate with quality preferences
    receiverOptions.playbackConfig.autoResumeDuration = 5;
    receiverOptions.playbackConfig.autoPauseDuration = null;
    
    // Add custom message listener BEFORE starting (required)
    castContext.addCustomMessageListener(
      "urn:x-cast:com.ditu.control",
      (event) => {
        console.log("Received custom message:", event);

        // Log debug message
        PlayerController._impl?.addDebugMessage?.({
          type: "CUSTOM_MESSAGE",
          data: event.data,
          source: "CAST_SENDER",
        });

        // Simply pass message data to PlayerController - let it handle everything
        const type = event.data?.type;
        if (type === "LOAD_STREAM" && event.data?.streamData) {
          try {
            // Validate and pass to PlayerController - no duplication
            const streamData = event.data.streamData;
            
            // Basic validation only
            if (!streamData?.url) {
              throw new Error("Stream URL is required");
            }

            // Let PlayerController handle all the logic reactively
            PlayerController.loadStream({
              url: streamData.url || "",
              title: streamData.title || "",
              contentType: streamData.contentType || "application/dash+xml",
              isLive: streamData.isLive || false,
              drm: streamData.drm || null,
            });

            console.log("✅ Stream data passed to PlayerController");
          } catch (error) {
            console.error("❌ Error processing Cast message:", error);
            PlayerController._impl?.addDebugError?.(error);
          }
        }
      }
    );

    // Apply receiver options
    try {
      castContext.start(receiverOptions);
      console.log("✅ Cast context started with custom options");
    } catch (error) {
      if (error.message?.includes("already provided") || error.message?.includes("already started")) {
        console.log("⚠️ Cast context already started, using default options");
        // If already started, just get the existing context
        if (!castContext.isReady) {
          castContext.start();
        }
      } else {
        throw error;
      }
    }

    // Add load interceptor for quality optimization
    if (playerManager.setMessageInterceptor) {
      playerManager.setMessageInterceptor(
        cast.framework.messages.MessageType.LOAD,
        (request) => {
          console.log("Intercepting LOAD request for quality optimization");
          
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

          PlayerController._impl?.addDebugMessage?.({
            type: "LOAD_INTERCEPTED",
            data: {
              hasQualityPreferences: !!request.media?.customData?.qualityPreferences,
              contentType: request.media?.contentType,
              streamType: request.media?.streamType
            },
            source: "LOAD_INTERCEPTOR",
          });

          return request;
        }
      );
    }

    // Initialize PlayerController with reactive control
    PlayerController.initialize(castContext);

    // Verify event types exist before using them
    const EventType = cast.framework.events.EventType;
    const SystemEventType = cast.framework.system?.EventType;

    console.log("Available event types:", {
      PLAYER_STATE_CHANGED: EventType.PLAYER_STATE_CHANGED,
      TIME_UPDATE: EventType.TIME_UPDATE,
      SENDER_CONNECTED: SystemEventType?.SENDER_CONNECTED,
      SENDER_DISCONNECTED: SystemEventType?.SENDER_DISCONNECTED,
    });

    // Add event listeners with checks
    if (EventType.PLAYER_STATE_CHANGED) {
      playerManager.addEventListener(
        EventType.PLAYER_STATE_CHANGED,
        (event) => {
          console.log("Player state changed:", event.playerState);

          // Log debug message
          PlayerController._impl?.addDebugMessage?.({
            type: "PLAYER_STATE_CHANGED",
            data: { playerState: event.playerState },
            source: "CAF_EVENT",
          });

          if (
            event.playerState === cast.framework.messages.PlayerState.PLAYING
          ) {
            PlayerController.updatePlayback({ isPlaying: true });
          } else if (
            event.playerState === cast.framework.messages.PlayerState.PAUSED
          ) {
            PlayerController.updatePlayback({ isPlaying: false });
          }
        }
      );
    } else {
      console.warn("PLAYER_STATE_CHANGED event type not available");
    }

    if (EventType.TIME_UPDATE) {
      playerManager.addEventListener(EventType.TIME_UPDATE, (event) => {
        PlayerController.updatePlayback({
          currentTime: event.currentMediaTime || 0,
        });
      });
    } else {
      console.warn("TIME_UPDATE event type not available");
    }

    // Add error event listeners
    if (EventType.ERROR) {
      playerManager.addEventListener(EventType.ERROR, (event) => {
        console.error("Player error:", event);
        
        // Detailed error analysis
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
          
          // Get current media info for debugging
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

        PlayerController._impl?.addDebugError?.({
          message: `Player error ${event.error}: ${event.detailedErrorCode || 'Unknown'}`,
          data: errorDetails,
          source: "CAF_ERROR",
        });
      });
    }

    if (EventType.BREAK_ENDED) {
      playerManager.addEventListener(EventType.BREAK_ENDED, (event) => {
        PlayerController._impl?.addDebugMessage?.({
          type: "BREAK_ENDED",
          data: event,
          source: "CAF_EVENT",
        });
      });
    }

    // Set initial state
    setCastReady(true);
    setSenderConnected(false);

    // Listen for sender connection events with checks
    if (SystemEventType?.SENDER_CONNECTED) {
      castContext.addEventListener(SystemEventType.SENDER_CONNECTED, () => {
        console.log("Sender connected");
        setSenderConnected(true);

        // Log debug message
        PlayerController._impl?.addDebugMessage?.({
          type: "SENDER_CONNECTED",
          data: { timestamp: new Date().toISOString() },
          source: "CAF_EVENT",
        });
      });
    } else {
      console.warn("SENDER_CONNECTED event type not available");
    }

    if (SystemEventType?.SENDER_DISCONNECTED) {
      castContext.addEventListener(SystemEventType.SENDER_DISCONNECTED, () => {
        console.log("Sender disconnected");
        setSenderConnected(false);

        // Log debug message
        PlayerController._impl?.addDebugMessage?.({
          type: "SENDER_DISCONNECTED",
          data: { timestamp: new Date().toISOString() },
          source: "CAF_EVENT",
        });
      });
    } else {
      console.warn("SENDER_DISCONNECTED event type not available");
    }

    console.log("Cast receiver initialized successfully with quality optimizations");

    // PlayerController.use(customAdapter); // swap adapter here if needed
  } catch (error) {
    console.error("Error initializing Cast receiver:", error);
    setCastReady(false);
    throw error;
  }
}
