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
    autoplay: true
  }
}
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

// Simulate loading a stream
window.testUtils.simulateLoadStream({
  url: "https://example.com/video.mp4",
  title: "Test Video"
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
  currentTime: 0     // Current playback time in seconds
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
