# Cast Receiver - SolidJS CMR

A custom Cast receiver application built with SolidJS for handling media streaming on Chromecast devices. This receiver is designed to work with the Ditu - Caracol media streaming platform.

## Overview

This Cast receiver app provides a custom media playback experience for Chromecast devices, allowing sender applications to stream video content with enhanced control and monitoring capabilities.

### Features

- 🎥 **Custom Media Receiver** - Handles video streaming from sender applications
- 📱 **Real-time Status Updates** - Shows connection status and playback information
- 🔧 **Developer Tools** - Built-in testing utilities for development
- 🎨 **Responsive Design** - Optimized for TV displays and various screen sizes
- ⚡ **SolidJS Framework** - Fast, reactive UI with minimal bundle size
- 🌐 **Cast Framework Integration** - Full Google Cast Application Framework (CAF) support

## Architecture

```text
src/
├── controllers/         # Media playback controllers
│   └── playerController.js
├── services/           # Cast framework integration
│   └── castService.js
├── stores/            # State management
│   └── videoStore.js
├── styles/            # CSS styling
│   └── cast-receiver.css
├── utils/             # Development utilities
│   └── testUtils.js
├── App.jsx           # Main application component
├── App.css           # Component styles
├── index.jsx         # Application entry point
└── index.css         # Global styles
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm, pnpm, or yarn
- A Chromecast device for testing (optional for development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cast-receiver-solid-cmr

# Install dependencies
npm install
# or
pnpm install
# or
yarn install
```

### Development

```bash
# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

> **Note:** When running locally, you'll see WebSocket connection errors in the console. This is expected behavior when not running on an actual Cast device.

### Building for Production

```bash
# Build the application
npm run build

# Preview the production build
npm run preview
```

## Usage

### Basic Media Streaming

To stream regular (non-DRM) media content to the receiver, send a custom message from your sender application:

```javascript
// From your Cast sender app
const castSession = cast.framework.CastContext.getInstance().getCurrentSession();

// Load a basic video stream
castSession.sendMessage('urn:x-cast:com.ditu.control', {
  type: "LOAD_STREAM",
  streamData: {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    title: "Big Buck Bunny",
    contentType: "video/mp4",
    autoplay: true
  }
});
```

### DRM-Protected Content

For DRM-protected content, include the DRM configuration with a valid license URL:

```javascript
// Load DRM-protected DASH stream
castSession.sendMessage('urn:x-cast:com.ditu.control', {
  type: "LOAD_STREAM",
  streamData: {
    url: "https://your-cdn.com/protected-content.mpd",
    title: "Protected Movie",
    contentType: "application/dash+xml",
    autoplay: true,
    drm: {
      licenseUrl: "https://your-drm-server.com/license",
      keySystem: "com.widevine.alpha",
      headers: {
        "Authorization": "Bearer your-access-token",
        "X-Custom-Data": "additional-metadata"
      }
    }
  }
});
```

### Supported Content Types

The receiver supports various media formats:

- **MP4 Video**: `video/mp4`
- **DASH Streams**: `application/dash+xml`
- **HLS Streams**: `application/vnd.apple.mpegurl`
- **WebM Video**: `video/webm`

### Development Testing

When developing locally, use the built-in test utilities:

```javascript
// Test regular content
window.testUtils.simulateLoadStream({
  url: "https://example.com/video.mp4",
  title: "Test Video"
});

// Test DRM content
window.testUtils.simulateLoadDRMStream({
  url: "https://example.com/protected.mpd",
  title: "DRM Test Video",
  licenseUrl: "https://drm-server.com/license"
});

// Check receiver status
window.testUtils.logCastState();
```

### Sender App Integration

To integrate this receiver with your Cast sender application:

1. **Register the receiver** at [Google Cast Console](https://cast.google.com/publish/)
2. **Use the Application ID** in your sender app initialization
3. **Send custom messages** to the `urn:x-cast:com.ditu.control` namespace

Example sender app code:

```javascript
// Initialize Cast API
window['__onGCastApiAvailable'] = function(isAvailable) {
  if (isAvailable) {
    cast.framework.CastContext.getInstance().setOptions({
      receiverApplicationId: 'YOUR_RECEIVER_APP_ID', // From Cast Console
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });
  }
};

// Load media with DRM
function loadProtectedMedia() {
  const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  
  if (castSession) {
    castSession.sendMessage('urn:x-cast:com.ditu.control', {
      type: "LOAD_STREAM",
      streamData: {
        url: "https://your-content.mpd",
        title: "Your Content Title",
        contentType: "application/dash+xml",
        drm: {
          licenseUrl: "https://your-license-server.com/license",
          keySystem: "com.widevine.alpha",
          headers: {
            "Authorization": "Bearer " + getAccessToken()
          }
        }
      }
    });
  }
}
```

## Cast Integration

### Custom Messages

The receiver listens for custom messages on the namespace `urn:x-cast:com.ditu.control`:

#### Load Stream Message

```javascript
{
  type: "LOAD_STREAM",
  streamData: {
    url: "https://example.com/video.mp4",
    title: "Video Title",
    contentType: "video/mp4",
    autoplay: true,
    // DRM configuration (optional)
    drm: {
      licenseUrl: "https://example.com/drm/license",
      keySystem: "com.widevine.alpha", // or "com.microsoft.playready"
      headers: {
        "Authorization": "Bearer token123",
        "X-Custom-Header": "value"
      }
    }
  }
}
```

### DRM Support

The receiver supports DRM-protected content with the following key systems:

- **Widevine** (`com.widevine.alpha`) - Default and most widely supported
- **PlayReady** (`com.microsoft.playready`) - Microsoft's DRM solution

#### DRM Configuration

When loading DRM-protected content, the `drm` object is **required** and must include:

- `licenseUrl` - The URL to the DRM license server (required)
- `keySystem` - The DRM system identifier (optional, defaults to Widevine)
- `headers` - Additional headers for license requests (optional)

#### Example DRM Stream

```javascript
// Load DRM-protected DASH stream
window.testUtils.simulateLoadDRMStream({
  url: "https://example.com/protected-content.mpd",
  title: "Protected Video",
  contentType: "application/dash+xml",
  licenseUrl: "https://drm.example.com/license",
  keySystem: "com.widevine.alpha",
  headers: {
    "Authorization": "Bearer your-license-token"
  }
})
```

### Event Handling

The receiver handles these Cast framework events:

- **PLAYER_STATE_CHANGED** - Updates playback status
- **TIME_UPDATE** - Updates current playback time
- **SENDER_CONNECTED** - Tracks sender connection status
- **SENDER_DISCONNECTED** - Handles sender disconnection

## Development Tools

The app includes built-in testing utilities accessible via the browser console:

```javascript
// Check Cast framework status
window.testUtils.logCastState()

// Simulate loading a regular stream
window.testUtils.simulateLoadStream({
  url: "https://example.com/video.mp4",
  title: "Test Video"
})

// Simulate loading a DRM-protected stream
window.testUtils.simulateLoadDRMStream({
  url: "https://example.com/protected.mpd",
  title: "DRM Protected Video",
  licenseUrl: "https://drm.example.com/license",
  keySystem: "com.widevine.alpha"
})
```

## Configuration

### Cast Application ID

To register this receiver with Google Cast:

1. Register your app at [Google Cast SDK Developer Console](https://cast.google.com/publish/)
2. Upload the built receiver to a publicly accessible HTTPS URL
3. Configure your sender apps to use the registered Application ID

### Custom Styling

The app uses a modular CSS architecture:

- `src/index.css` - Global styles and utilities
- `src/App.css` - Main component styles
- `src/styles/cast-receiver.css` - Cast-specific styles and animations

## State Management

The app uses SolidJS stores for reactive state management:

```javascript
// Video store structure
{
  url: "",           // Current media URL
  title: "",         // Media title
  contentType: "",   // MIME type
  isPlaying: false,  // Playback status
  currentTime: 0,    // Current playback time in seconds
  // DRM configuration
  drm: {
    licenseUrl: "",  // DRM license server URL
    keySystem: "",   // DRM system (e.g., "com.widevine.alpha")
    headers: {},     // Additional headers for license requests
    enabled: false   // Whether DRM is active for current content
  }
}
```

## Deployment

### Production Deployment

1. Build the application: `npm run build`
2. Upload the `dist/` folder contents to a publicly accessible HTTPS server
3. Ensure the server serves the correct MIME types for all file extensions
4. Register the receiver URL with Google Cast

### Requirements

- **HTTPS only** - Cast receivers must be served over HTTPS
- **CORS headers** - Ensure proper CORS configuration for media files
- **Content-Type headers** - Serve files with correct MIME types

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

> **Note:** For actual Cast device deployment, the receiver runs in the Cast device's Chromium-based browser.

## Troubleshooting

### Common Issues

**WebSocket connection errors**: Normal in development mode when not running on a Cast device.

**Cast framework not loaded**: Ensure the CDN script is accessible and loading properly.

**Media playback issues**: Check CORS headers and media file accessibility from the Cast device.

### Debug Mode

Enable verbose logging by opening browser developer tools. The app provides detailed console output for debugging Cast framework integration.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and test thoroughly
4. Commit changes: `git commit -m "Add new feature"`
5. Push to branch: `git push origin feature/new-feature`
6. Submit a Pull Request

## License

This project is part of the Ditu - Caracol media platform.

## Learn More

- [SolidJS Documentation](https://solidjs.com)
- [Google Cast Developer Documentation](https://developers.google.com/cast)
- [Cast Application Framework (CAF) Guide](https://developers.google.com/cast/docs/caf_receiver)
