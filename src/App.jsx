import { onMount } from "solid-js";
import "./App.css";
import "./styles/cast-receiver.css";
import { initializeCastReceiver } from "./services/castService";
import { testUtils } from "./utils/testUtils";
import DebugOverlay from "./components/DebugOverlay";

export default function App() {
  onMount(async () => {
    try {
      await initializeCastReceiver();
      console.log("✅ Cast receiver app loaded successfully");
      console.log("🔧 Test utilities available as window.testUtils or use testUtils in console");
      testUtils.logCastState();
    } catch (e) {
      console.error("Failed to initialize Cast receiver:", e);
    }
  });

  return (
    <div class="app-container">
      {/* Debug Overlay - Single Column Layout */}
      <div class="debug-overlay-container">
        <DebugOverlay />
      </div>
    </div>
  );
}