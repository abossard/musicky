using Microsoft.JSInterop;

namespace Musicky.Web.Services;

public interface IAudioPlayerService
{
    event EventHandler<AudioPlayerEventArgs>? StateChanged;
    Task InitializeAsync();
    Task LoadTrackAsync(string filePath);
    Task PlayAsync();
    Task PauseAsync();
    Task SetVolumeAsync(double volume);
    Task SeekAsync(double position);
    Task<AudioPlayerState> GetStateAsync();
}

public class AudioPlayerService : IAudioPlayerService, IAsyncDisposable
{
    private readonly IJSRuntime _jsRuntime;
    private IJSObjectReference? _audioPlayerModule;
    private DotNetObjectReference<AudioPlayerService>? _dotNetRef;

    public event EventHandler<AudioPlayerEventArgs>? StateChanged;

    public AudioPlayerService(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
    }

    public async Task InitializeAsync()
    {
        try
        {
            _audioPlayerModule = await _jsRuntime.InvokeAsync<IJSObjectReference>(
                "import", "./js/audioPlayer.js");
            
            _dotNetRef = DotNetObjectReference.Create(this);
            await _audioPlayerModule.InvokeVoidAsync("initialize", _dotNetRef);
        }
        catch (InvalidOperationException)
        {
            // JavaScript interop not available (e.g., during prerendering or testing)
            // This is expected and should be handled gracefully
        }
    }

    public async Task LoadTrackAsync(string filePath)
    {
        if (_audioPlayerModule != null)
        {
            await _audioPlayerModule.InvokeVoidAsync("loadTrack", filePath);
        }
    }

    public async Task PlayAsync()
    {
        if (_audioPlayerModule != null)
        {
            await _audioPlayerModule.InvokeVoidAsync("play");
        }
    }

    public async Task PauseAsync()
    {
        if (_audioPlayerModule != null)
        {
            await _audioPlayerModule.InvokeVoidAsync("pause");
        }
    }

    public async Task SetVolumeAsync(double volume)
    {
        if (_audioPlayerModule != null)
        {
            await _audioPlayerModule.InvokeVoidAsync("setVolume", volume);
        }
    }

    public async Task SeekAsync(double position)
    {
        if (_audioPlayerModule != null)
        {
            await _audioPlayerModule.InvokeVoidAsync("seek", position);
        }
    }

    public async Task<AudioPlayerState> GetStateAsync()
    {
        if (_audioPlayerModule != null)
        {
            return await _audioPlayerModule.InvokeAsync<AudioPlayerState>("getState");
        }
        return new AudioPlayerState();
    }

    [JSInvokable]
    public void OnStateChanged(AudioPlayerState state)
    {
        StateChanged?.Invoke(this, new AudioPlayerEventArgs(state));
    }

    public async ValueTask DisposeAsync()
    {
        if (_audioPlayerModule != null)
        {
            await _audioPlayerModule.DisposeAsync();
        }
        _dotNetRef?.Dispose();
    }
}

public class AudioPlayerState
{
    public bool IsPlaying { get; set; }
    public double CurrentTime { get; set; }
    public double Duration { get; set; }
    public double Volume { get; set; } = 1.0;
    public string? CurrentTrack { get; set; }
    public bool IsLoaded { get; set; }
}

public class AudioPlayerEventArgs : EventArgs
{
    public AudioPlayerState State { get; }

    public AudioPlayerEventArgs(AudioPlayerState state)
    {
        State = state;
    }
}