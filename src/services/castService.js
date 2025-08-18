import { createSignal } from "solid-js";
import { PlayerController } from "../controllers/playerController";

export const [castReady, setCastReady] = createSignal(false);
export const [senderConnected, setSenderConnected] = createSignal(false);

let castContext = null;

function handleLoadStream(streamData) {
  console.log("Loading stream:", streamData);
  
  try {
    PlayerController.loadStream({
      url: streamData.url || "",
      title: streamData.title || "",
      contentType: streamData.contentType || "application/dash+xml",
    });

    const playerManager = castContext?.getPlayerManager();
    if (playerManager && streamData.url) {
      const mediaInfo = new cast.framework.messages.MediaInformation();
      mediaInfo.contentId = streamData.url;
      mediaInfo.contentType = streamData.contentType || "application/dash+xml";

      if (streamData.title) {
        mediaInfo.metadata = new cast.framework.messages.GenericMediaMetadata();
        mediaInfo.metadata.title = streamData.title;
      }

      const request = new cast.framework.messages.LoadRequestData();
      request.media = mediaInfo;
      request.autoplay = streamData.autoplay !== false;

      playerManager.load(request);
      console.log("Media loaded successfully");
    } else {
      console.warn("Player manager not available or no URL provided");
    }
  } catch (error) {
    console.error("Error loading stream:", error);
  }
}

function waitForCastFramework() {
  return new Promise((resolve, reject) => {
    if (typeof cast !== "undefined" && cast.framework && cast.framework.CastReceiverContext) {
      resolve();
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max wait
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (typeof cast !== "undefined" && cast.framework && cast.framework.CastReceiverContext) {
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
      SENDER_DISCONNECTED: SystemEventType?.SENDER_DISCONNECTED
    });

    // Add event listeners with checks
    if (EventType.PLAYER_STATE_CHANGED) {
      playerManager.addEventListener(
        EventType.PLAYER_STATE_CHANGED,
        (event) => {
          console.log("Player state changed:", event.playerState);
          if (event.playerState === cast.framework.messages.PlayerState.PLAYING) {
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
      playerManager.addEventListener(
        EventType.TIME_UPDATE,
        (event) => {
          PlayerController.updatePlayback({ currentTime: event.currentMediaTime || 0 });
        }
      );
    } else {
      console.warn("TIME_UPDATE event type not available");
    }

    // Add custom message listener
    castContext.addCustomMessageListener(
      "urn:x-cast:com.ditu.control",
      (event) => {
        console.log("Received custom message:", event);
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
      castContext.addEventListener(
        SystemEventType.SENDER_CONNECTED,
        () => {
          console.log("Sender connected");
          setSenderConnected(true);
        }
      );
    } else {
      console.warn("SENDER_CONNECTED event type not available");
    }

    if (SystemEventType?.SENDER_DISCONNECTED) {
      castContext.addEventListener(
        SystemEventType.SENDER_DISCONNECTED,
        () => {
          console.log("Sender disconnected");
          setSenderConnected(false);
        }
      );
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
