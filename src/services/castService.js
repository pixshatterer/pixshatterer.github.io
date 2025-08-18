import { createSignal } from "solid-js";
import { PlayerController } from "../controllers/playerController";

export const [castReady, setCastReady] = createSignal(false);
export const [senderConnected, setSenderConnected] = createSignal(false);

let castContext = null;

function handleLoadStream(streamData) {
  console.log("Loading stream:", streamData);

  try {
    // Log debug message
    PlayerController._impl?.addDebugMessage?.({
      type: "LOAD_STREAM",
      data: streamData,
      source: "castService",
    });

    // Validate DRM requirements
    if (streamData.drm?.licenseUrl && !streamData.drm.licenseUrl.trim()) {
      throw new Error("DRM license URL is required but empty");
    }

    PlayerController.loadStream({
      url: streamData.url || "",
      title: streamData.title || "",
      contentType: streamData.contentType || "application/dash+xml",
      isLive: streamData.isLive || false,
      drm: streamData.drm || null,
    });

    const playerManager = castContext?.getPlayerManager();
    if (playerManager && streamData.url) {
      const mediaInfo = new cast.framework.messages.MediaInformation();
      mediaInfo.contentId = streamData.url;
      mediaInfo.contentType = streamData.contentType || "application/dash+xml";
      mediaInfo.streamType = streamData.isLive
        ? cast.framework.messages.StreamType.LIVE
        : cast.framework.messages.StreamType.BUFFERED;

      // Configure DRM if provided
      if (streamData.drm?.licenseUrl) {
        console.log(
          "Configuring DRM with license URL:",
          streamData.drm.licenseUrl
        );

        // Set up DRM configuration for Cast framework
        const drmConfig = {};

        // Configure Widevine (most common for Cast)
        if (
          streamData.drm.keySystem === "com.widevine.alpha" ||
          !streamData.drm.keySystem
        ) {
          drmConfig.widevine = {
            licenseUrl: streamData.drm.licenseUrl,
            headers: streamData.drm.headers || {},
          };
        }

        // Configure PlayReady if specified
        if (streamData.drm.keySystem === "com.microsoft.playready") {
          drmConfig.playready = {
            licenseUrl: streamData.drm.licenseUrl,
            headers: streamData.drm.headers || {},
          };
        }

        // Apply DRM configuration to media info
        if (Object.keys(drmConfig).length > 0) {
          mediaInfo.customData = {
            ...mediaInfo.customData,
            drm: drmConfig,
          };
        }
      }

      if (streamData.title) {
        mediaInfo.metadata = new cast.framework.messages.GenericMediaMetadata();
        mediaInfo.metadata.title = streamData.title;
      }

      const request = new cast.framework.messages.LoadRequestData();
      request.media = mediaInfo;
      request.autoplay = streamData.autoplay !== false;

      playerManager.load(request);
      console.log(
        "Media loaded successfully",
        streamData.drm ? "with DRM" : "without DRM"
      );

      // Log success message
      PlayerController._impl?.addDebugMessage?.({
        type: "MEDIA_LOADED",
        data: {
          url: streamData.url,
          title: streamData.title,
          hasDRM: !!streamData.drm,
        },
        source: "castService",
      });
    } else {
      const errorMsg = "Player manager not available or no URL provided";
      console.warn(errorMsg);
      PlayerController._impl?.addDebugError?.({
        message: errorMsg,
        data: { hasPlayerManager: !!playerManager, hasUrl: !!streamData.url },
      });
    }
  } catch (error) {
    console.error("Error loading stream:", error);
    PlayerController._impl?.addDebugError?.(error);
    throw error;
  }
}

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
        PlayerController._impl?.addDebugError?.({
          message: `Player error: ${event.detailedErrorCode || event.error}`,
          data: event,
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

    // Add custom message listener
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

        const type = event.data?.type;
        if (type === "LOAD_STREAM") {
          handleLoadStream(event.data.streamData);
        }
      }
    );

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

    // Start the cast context
    castContext.start();
    console.log("Cast receiver initialized successfully");

    // PlayerController.use(customAdapter); // swap adapter here if needed
  } catch (error) {
    console.error("Error initializing Cast receiver:", error);
    setCastReady(false);
    throw error;
  }
}
