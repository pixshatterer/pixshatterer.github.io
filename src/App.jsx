import { onMount, Show } from "solid-js";
import "./App.css";
import "./styles/cast-receiver.css";
import { initializeCastReceiver } from "./services/castService";
import { testUtils } from "./utils/testUtils";
import DebugOverlay from "./components/DebugOverlay";
import dituLogo from "./assets/ditu_logo_big.png";

export default function App() {
  const isDebug = !!Number(import.meta.env.VITE_DEBUG);
  onMount(async () => {
    try {
      await initializeCastReceiver();
      console.log("✅ Cast receiver app loaded successfully");
      console.log(
        "🔧 Test utilities available as window.testUtils or use testUtils in console"
      );
      testUtils.logCastState();
    } catch (e) {
      console.error("Failed to initialize Cast receiver:", e);
    }
  });

  return (
    <div class="app-container">
      <Show when={isDebug}>
        {/* Debug Overlay - Single Column Layout */}
        <div class="debug-overlay-container">
          <DebugOverlay />
        </div>
      </Show>
      <div class="standby-container">
        <img src={dituLogo} alt="Ditu Logo" class="ditu-logo-standby" />
        <h2 class="standby-message">{import.meta.env.VITE_STANDBY_MSG}</h2>
      </div>
    </div>
  );
}
