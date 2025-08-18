import { createSignal } from "solid-js";
import { PlayerController } from "../controllers/playerController";

export const [castReady, setCastReady] = createSignal(false);
export const [senderConnected, setSenderConnected] = createSignal(false);

let castContext = null;

function handleLoadStream(streamData) {
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
  }
}

export function initializeCastReceiver() {
  if (typeof cast === "undefined") {
    throw new Error("Cast framework not loaded");
  }
  castContext = cast.framework.CastReceiverContext.getInstance();
  const playerManager = castContext.getPlayerManager();

  playerManager.addEventListener(
    cast.framework.events.EventType.PLAYER_STATE_CHANGED,
    (event) => {
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
      PlayerController.updatePlayback({ currentTime: event.currentMediaTime });
    }
  );

  castContext.addCustomMessageListener(
    "urn:x-cast:com.ditu.control",
    (event) => {
      const type = event.data?.type;
      if (type === "LOAD_STREAM") handleLoadStream(event.data.streamData);
    }
  );

  castContext.start();
  // PlayerController.use(customAdapter); // swap adapter here if needed
  setCastReady(true);
}
