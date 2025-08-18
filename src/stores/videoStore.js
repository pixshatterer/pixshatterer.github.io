import { createStore } from "solid-js/store";

export const [videoStore, setVideoStore] = createStore({
  url: "",
  title: "",
  contentType: "",
  isPlaying: false,
  currentTime: 0,
});

export const videoActions = {
  loadStream({ url, title, contentType }) {
    setVideoStore({ url, title, contentType });
  },
  updatePlayback(partial) {
    setVideoStore(partial);
  },
  reset() {
    setVideoStore({
      url: "",
      title: "",
      contentType: "",
      isPlaying: false,
      currentTime: 0,
    });
  },
};
