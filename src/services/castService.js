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

export function initializeCastReceiver() {
  // Check if Cast framework is available
  if (typeof cast === "undefined") {
    console.error("Cast framework not loaded. Make sure the CAF Receiver runtime script is included.");
    throw new Error("Cast framework not loaded. Make sure the CAF Receiver runtime script is included.");
  }

  try {
    castContext = cast.framework.CastReceiverContext.getInstance();
    const playerManager = castContext.getPlayerManager();

    // Add event listeners
    playerManager.addEventListener(
      cast.framework.events.EventType.PLAYER_STATE_CHANGED,
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

    playerManager.addEventListener(
      cast.framework.events.EventType.TIME_UPDATE,
      (event) => {
        PlayerController.updatePlayback({ currentTime: event.currentMediaTime || 0 });
      }
    );

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

    // Start the cast context
    castContext.start();
    console.log("Cast receiver initialized successfully");
    
    // PlayerController.use(customAdapter); // swap adapter here if needed
    setCastReady(true);
    setSenderConnected(false);

    // Listen for sender connection events
    castContext.addEventListener(
      cast.framework.system.EventType.SENDER_CONNECTED,
      () => {
        console.log("Sender connected");
        setSenderConnected(true);
      }
    );

    castContext.addEventListener(
      cast.framework.system.EventType.SENDER_DISCONNECTED,
      () => {
        console.log("Sender disconnected");
        setSenderConnected(false);
      }
    );

  } catch (error) {
    console.error("Error initializing Cast receiver:", error);
    throw error;
  }
}
