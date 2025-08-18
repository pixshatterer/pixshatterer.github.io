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
