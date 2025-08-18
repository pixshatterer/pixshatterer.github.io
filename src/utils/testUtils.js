// Test utilities for simulating Cast functionality when testing locally
export const testUtils = {
  simulateLoadStream(data = {}) {
    const streamData = {
      url: data.url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      title: data.title || "Test Video",
      contentType: data.contentType || "video/mp4",
      autoplay: data.autoplay !== false,
      ...data
    };

    console.log("🧪 Simulating LOAD_STREAM message:", streamData);
    
    // Simulate the custom message that would come from a Cast sender
    if (typeof cast !== "undefined") {
      console.log("Cast framework available - would normally receive message from sender");
      
      // Manually trigger the handler if Cast context exists
      try {
        cast.framework.CastReceiverContext.getInstance();
        console.log("Cast context available, would normally receive this from sender");
      } catch (error) {
        console.warn("Cast context not available for simulation:", error.message);
      }
    }
    
    return streamData;
  },

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
  }
};

// Make it available globally for browser console testing
if (typeof window !== "undefined") {
  window.testUtils = testUtils;
}
