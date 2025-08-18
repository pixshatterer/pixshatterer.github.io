import { videoActions } from "../stores/videoStore";

export const PlayerController = {
  _impl: videoActions,
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
