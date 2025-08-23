import { createSignal } from "solid-js";
import { PlayerController } from "../controllers/playerController";
import { NAMESPACE } from "../config/playerConfig";

export const [castReady, setCastReady] = createSignal(false);
export const [senderConnected, setSenderConnected] = createSignal(false);

let castContext = null;

// Function to send custom messages to all connected senders
export function sendMessageToSenders(messageType, data) {
  if (!castContext) {
    PlayerController._impl?.addDebugError?.({
      message: "Cast context not available - cannot send message to senders",
      data: { messageType, data },
      source: "CAST_SERVICE",
    });
    return false;
  }

  try {
    const message = {
      type: messageType,
      data: data,
      timestamp: new Date().toISOString(),
    };

    // Send to all connected senders on the custom namespace
    castContext.sendCustomMessage(
      NAMESPACE,
      undefined, // senderId - undefined means send to all senders
      message
    );

    // Log the sent message for debugging
    PlayerController._impl?.addDebugMessage?.({
      type: "MESSAGE_SENT_TO_SENDER",
      data: {
        messageType,
        sentData: data,
        success: true,
      },
      source: "CAST_SERVICE",
    });

    return true;
  } catch (error) {
    PlayerController._impl?.addDebugError?.({
      message: "Failed to send message to senders",
      data: {
        messageType,
        error: error.message || error,
        data,
      },
      source: "CAST_SERVICE",
    });

    return false;
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
    // Configure Cast receiver options
    const receiverOptions = new cast.framework.CastReceiverOptions();
    receiverOptions.maxInactivity = 6000; // 10 minutes
    receiverOptions.playbackConfig = new cast.framework.PlaybackConfig();
    // shaka settings
    receiverOptions.playbackConfig.shakaConfig = {     
      drm: {
        servers: {
          "com.widevine.alpha": `${
            import.meta.env.VITE_BASE_URL
          }/CONTENT/LICENSE`,
        },
      },
      manifest: {
        dash: { ignoreMinBufferTime: true },
        retryParameters: { maxAttempts: 3 },
      },
      streaming: {
        stallSkip: 0.2,
        bufferingGoal: 12,
        rebufferingGoal: 2,
        bufferBehind: 5,
        retryParameters: { maxAttempts: 5, backoffFactor: 2 },
      },
      abr: { enabled: true },
    };

    // Enable adaptive bitrate with quality preferences
    receiverOptions.playbackConfig.autoResumeDuration = 5;
    receiverOptions.playbackConfig.autoPauseDuration = null;
    // Enable DRM settings
    receiverOptions.playbackConfig.protectionSystem =
      cast.framework.ContentProtection.WIDEVINE;
    /*
      receiverOptions.playbackConfig.licenseUrl = `${
      import.meta.env.VITE_BASE_URL
    }/CONTENT/LICENSE`;
    */
    // This handler runs for each LICENSE request
    receiverOptions.playbackConfig.licenseRequestHandler = (requestInfo) => {
      // Same as request.allowCrossSiteCredentials
      requestInfo.withCredentials = true;
      // Merge/override headers for the license POST
      requestInfo.headers = {
        "Content-Type": "application/octet-stream", // OK for Widevine license POST
        restful: "yes", // your custom header
      };
    };
    // Add custom message listener BEFORE starting (required)
    castContext.addCustomMessageListener(NAMESPACE, async (event) => {
      // Log debug message
      PlayerController._impl?.addDebugMessage?.({
        type: "CUSTOM_MESSAGE",
        data: event.data,
        source: "CAST_SENDER",
      });

      // Simply pass message data to PlayerController - let it handle everything
      const playerManager = castContext.getPlayerManager();
      const { data } = event || {};
      const type = data?.type;
      let result;
      try {
        switch (type) {
          case "PLAY":
            result = await playerManager.play();
            sendMessageToSenders("PLAY", { result });
            break;
          case "PAUSE":
            result = await playerManager.pause();
            sendMessageToSenders("PAUSE", { result });
            break;
          case "SEEK": {
            const t = Number(data?.position);
            if (!Number.isFinite(t) || t < 0)
              throw new Error("invalid_position");
            result = await playerManager.seek(t);
            sendMessageToSenders("SEEK", { result });
            break;
          }
          case "LOAD_STREAM": {
            const streamData = data?.streamData || {};
            const origin = window.location.origin;
            PlayerController._impl?.loadStream?.(streamData);
            sendMessageToSenders("LOAD_STREAM", { origin, ...streamData });
            break;
          }
          case "LOAD_ASSET": {
            const assetData = data?.assetData || {};
            PlayerController._impl?.loadAsset?.(assetData);
            sendMessageToSenders("LOAD_ASSET", { assetData });
            break;
          }
          default:
            PlayerController._impl?.addDebugMessage?.({
              type: "CUSTOM_MESSAGE_UNKNOWN",
              data: event.data,
              source: "CAST_SENDER",
            });
        }
      } catch (error) {
        PlayerController._impl?.addDebugError?.({
          message: "Error initializing Custom Message Listener",
          data: error,
          source: "CAST_SERVICE",
        });
      }
    });

    // Apply receiver options
    try {
      castContext.start(receiverOptions);

      PlayerController._impl?.addDebugMessage?.({
        type: "CAST_CONTEXT_STARTED",
        data: {
          options: JSON.stringify(receiverOptions, null, 2),
          withCustomOptions: true,
        },
        source: "CAST_SERVICE",
      });
    } catch (error) {
      if (
        error.message?.includes("already provided") ||
        error.message?.includes("already started")
      ) {
        PlayerController._impl?.addDebugMessage?.({
          type: "CAST_CONTEXT_ALREADY_STARTED",
          data: { usingDefaults: true },
          source: "CAST_SERVICE",
        });
        // If already started, just get the existing context
        if (!castContext.isReady) {
          castContext.start();
        }
      } else {
        throw error;
      }
    }

    // Initialize PlayerController with reactive control
    PlayerController.initialize(castContext);

    // Verify system event types exist before using them
    const SystemEventType = cast.framework.system?.EventType;

    // Set initial state
    setCastReady(true);
    setSenderConnected(false);

    // Listen for sender connection events (system-level, not player-level)
    if (SystemEventType?.SENDER_CONNECTED) {
      castContext.addEventListener(SystemEventType.SENDER_CONNECTED, () => {
        setSenderConnected(true);

        // Log debug message
        PlayerController._impl?.addDebugMessage?.({
          type: "SENDER_CONNECTED",
          data: { timestamp: new Date().toISOString() },
          source: "CAF_EVENT",
        });
      });
    } else {
      PlayerController._impl?.addDebugMessage?.({
        type: "EVENT_TYPE_WARNING",
        data: { missing: "SENDER_CONNECTED" },
        source: "CAST_SERVICE",
      });
    }

    if (SystemEventType?.SENDER_DISCONNECTED) {
      castContext.addEventListener(SystemEventType.SENDER_DISCONNECTED, () => {
        setSenderConnected(false);

        // Log debug message
        PlayerController._impl?.addDebugMessage?.({
          type: "SENDER_DISCONNECTED",
          data: { timestamp: new Date().toISOString() },
          source: "CAF_EVENT",
        });
      });
    } else {
      PlayerController._impl?.addDebugMessage?.({
        type: "EVENT_TYPE_WARNING",
        data: { missing: "SENDER_DISCONNECTED" },
        source: "CAST_SERVICE",
      });
    }

    PlayerController._impl?.addDebugMessage?.({
      type: "CAST_RECEIVER_INITIALIZED",
      data: {
        success: true,
        hasQualityOptimizations: true,
        timestamp: new Date().toISOString(),
      },
      source: "CAST_SERVICE",
    });

    // PlayerController.use(customAdapter); // swap adapter here if needed
  } catch (error) {
    setCastReady(false);
    PlayerController._impl?.addDebugError?.({
      message: "Error initializing Cast receiver",
      data: error,
      source: "CAST_SERVICE",
    });
    throw error;
  }
}
