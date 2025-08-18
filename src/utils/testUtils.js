// Test utilities for simulating Cast functionality when testing locally
// Note: These functions only work in local development, not on actual Cast devices
import { videoActions } from "../stores/videoStore";

export const testUtils = {
  // Only for local development - checks Cast framework status
  logCastState() {
    console.log("🔍 Current Cast State:");
    console.log("- Cast framework available:", typeof cast !== "undefined");
    if (typeof cast !== "undefined") {
      try {
        const context = cast.framework.CastReceiverContext.getInstance();
        console.log("- Cast context:", !!context);
        console.log("- Player manager:", !!context?.getPlayerManager());
      } catch (error) {
        console.log("- Cast context error:", error.message);
      }
    }
    
    // Log debug message
    videoActions.addDebugMessage({
      type: "CAST_STATE_CHECK",
      data: { 
        castAvailable: typeof cast !== "undefined",
        timestamp: new Date().toISOString()
      },
      source: "DEV_UTILS"
    });
  }
};

// Make it available globally for browser console testing in development
if (typeof window !== "undefined") {
  window.testUtils = testUtils;
}
