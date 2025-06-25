# Audio Player Component

A simple, feature-rich MP3 player built with React, TypeScript, and Mantine UI components.

## Features

- ✅ **HTML5 Audio-based** - Simple and reliable
- ✅ **Custom Controls** - Play/pause with loading states
- ✅ **Seeking Support** - Click or drag on progress bar to seek
- ✅ **Volume Control** - Mute/unmute and volume slider
- ✅ **Time Display** - Current time and total duration
- ✅ **Error Handling** - User-friendly error messages
- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **TypeScript** - Full type safety
- ✅ **Mantine Integration** - Follows your app's theme

## Components

### AudioPlayer (Main Component)

```tsx
import { AudioPlayer } from './components/AudioPlayer';

<AudioPlayer
  src="/path/to/audio.mp3"
  title="Track Title"
  artist="Artist Name"
  autoPlay={false}
  onEnded={() => console.log('Track ended')}
  onError={(error) => console.error(error)}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **required** | URL/path to the MP3 file |
| `title` | `string` | `"Unknown Track"` | Display title |
| `artist` | `string` | `"Unknown Artist"` | Artist name |
| `autoPlay` | `boolean` | `false` | Auto-play when loaded |
| `onEnded` | `() => void` | `undefined` | Callback when track ends |
| `onError` | `(error: string) => void` | `undefined` | Error callback |

### AudioPlayerDemo (Helper Component)

A wrapper component that provides a nice UI for demonstrating the player:

```tsx
import { AudioPlayerDemo } from './components/AudioPlayerDemo';

<AudioPlayerDemo
  src="/lifekiller.mp3"
  title="Life Killer"
  artist="Sample Track"
  collapsible={true}
/>
```

## Usage Examples

### Basic Player

```tsx
import { AudioPlayer } from './components/AudioPlayer';

function MyMusicPage() {
  return (
    <div>
      <h1>Now Playing</h1>
      <AudioPlayer
        src="/my-song.mp3"
        title="My Favorite Song"
        artist="My Favorite Artist"
      />
    </div>
  );
}
```

### With Event Handlers

```tsx
import { AudioPlayer } from './components/AudioPlayer';
import { notifications } from '@mantine/notifications';

function MyMusicPage() {
  const handleTrackEnd = () => {
    notifications.show({
      title: 'Track Finished',
      message: 'The track has ended!',
    });
  };

  const handleError = (error: string) => {
    notifications.show({
      title: 'Playback Error',
      message: error,
      color: 'red',
    });
  };

  return (
    <AudioPlayer
      src="/my-song.mp3"
      title="My Favorite Song"
      artist="My Favorite Artist"
      onEnded={handleTrackEnd}
      onError={handleError}
    />
  );
}
```

### Integration with File Browser

```tsx
import { AudioPlayerDemo } from './components/AudioPlayerDemo';

function FileItem({ file }: { file: FileInfo }) {
  if (file.type === 'audio/mpeg') {
    return (
      <AudioPlayerDemo
        src={file.path}
        title={file.name}
        collapsible={true}
      />
    );
  }
  
  return <div>Other file type...</div>;
}
```

## Server Requirements

For proper seeking functionality, your server needs to:

1. **Support HTTP Range Requests** - Add these headers:
   ```
   Accept-Ranges: bytes
   Content-Range: bytes <start>-<end>/<total>
   ```

2. **Enable persistent connections** - Add:
   ```
   Connection: keep-alive
   ```

3. **Proper MIME types** - Serve MP3 files with:
   ```
   Content-Type: audio/mpeg
   ```

### Fastify Server Example

```typescript
// In your fastify server setup
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
  setHeaders: (res, path) => {
    if (path.endsWith('.mp3')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'audio/mpeg');
    }
  }
});
```

## Browser Compatibility

- ✅ **Chrome 90+** - Full support
- ✅ **Firefox 88+** - Full support  
- ✅ **Safari 14+** - Full support
- ✅ **Edge 90+** - Full support

## Performance Tips

1. **Use appropriate MP3 encoding**:
   - Constant bit rate (CBR) for better seeking
   - 128-320 kbps for good quality/size balance

2. **Preload behavior**:
   - Uses `preload="metadata"` by default
   - Only loads duration and basic info, not the full file

3. **Memory management**:
   - Audio elements are properly cleaned up on unmount
   - No memory leaks from event listeners

## Troubleshooting

### Seeking doesn't work
- Check that your server supports HTTP Range requests
- Ensure MP3 files use constant bit rate encoding
- Verify `Accept-Ranges: bytes` header is present

### Audio won't play
- Check browser console for network errors
- Verify file path is correct and accessible
- Ensure proper MIME type is set on server

### Performance issues
- Use compressed MP3 files (not WAV/FLAC)
- Consider implementing lazy loading for large playlists
- Check for memory leaks if using many players simultaneously

## Future Enhancements

Potential improvements you could add:

- 🔄 **Playlist support** - Queue multiple tracks
- 📊 **Audio visualization** - Web Audio API integration
- 🎚️ **Equalizer** - Real-time audio effects
- 💾 **Playback state persistence** - Remember position/volume
- ⌨️ **Keyboard shortcuts** - Space bar, arrow keys
- 📱 **Media session API** - Background controls on mobile
- 🔀 **Shuffle/repeat modes** - Advanced playback options
