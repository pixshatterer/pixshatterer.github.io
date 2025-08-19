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
      timestamp: new Date().toISOString()
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
        success: true
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
        data
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
    
    // Enable adaptive bitrate with quality preferences
    receiverOptions.playbackConfig.autoResumeDuration = 5;
    receiverOptions.playbackConfig.autoPauseDuration = null;
    
    // Add custom message listener BEFORE starting (required)
    castContext.addCustomMessageListener(
      "urn:x-cast:com.ditu.control",
      (event) => {
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

            // Debug what we received
            PlayerController._impl?.addDebugMessage?.({
              type: "STREAM_DATA_RECEIVED",
              data: {
                isLive: streamData.isLive,
                isLiveType: typeof streamData.isLive,
                isLiveValue: JSON.stringify(streamData.isLive),
                url: streamData.url,
                title: streamData.title,
                contentType: streamData.contentType,
                customData: streamData.customData
              },
              source: "CAST_MESSAGE",
            });

            // Let PlayerController handle all the logic reactively
            const isLive = streamData.isLive || false;
            const streamType = isLive 
              ? cast.framework.messages.StreamType.LIVE 
              : cast.framework.messages.StreamType.BUFFERED;
            
            // Extract title from customDat attribute
            const title = `${streamData?.customData?.title || ""}${
                streamData?.customData?.episodeTitle
                ? ` - ${streamData?.customData?.episodeTitle}`
                : ""
            }` || "Untitled Stream";

            PlayerController.loadStream({
              url: streamData.url || "",
              title: title,
              contentType: streamData.contentType || "application/dash+xml",
              isLive: isLive,
              streamType: streamType,
              drm: streamData.drm || null,
            });

            PlayerController._impl?.addDebugMessage?.({
              type: "STREAM_PASSED_TO_CONTROLLER",
              data: { success: true },
              source: "CAST_MESSAGE",
            });
          } catch (error) {
            PlayerController._impl?.addDebugError?.({
              message: "Error processing Cast message",
              data: error,
              source: "CAST_MESSAGE",
            });
          }
        }
      }
    );

    // Apply receiver options
    try {
      castContext.start(receiverOptions);
      
      PlayerController._impl?.addDebugMessage?.({
        type: "CAST_CONTEXT_STARTED",
        data: { withCustomOptions: true },
        source: "CAST_SERVICE",
      });
    } catch (error) {
      if (error.message?.includes("already provided") || error.message?.includes("already started")) {
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
        timestamp: new Date().toISOString()
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
