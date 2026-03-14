class AudioPlayerManager {
    constructor() {
        this.audio = new Audio();
        this.dotNetRef = null;
        this.state = {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            volume: 1.0,
            currentTrack: null,
            isLoaded: false
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.audio.addEventListener('loadedmetadata', () => {
            this.state.duration = this.audio.duration;
            this.state.isLoaded = true;
            this.notifyStateChanged();
        });

        this.audio.addEventListener('timeupdate', () => {
            this.state.currentTime = this.audio.currentTime;
            this.notifyStateChanged();
        });

        this.audio.addEventListener('play', () => {
            this.state.isPlaying = true;
            this.notifyStateChanged();
        });

        this.audio.addEventListener('pause', () => {
            this.state.isPlaying = false;
            this.notifyStateChanged();
        });

        this.audio.addEventListener('ended', () => {
            this.state.isPlaying = false;
            this.notifyStateChanged();
        });

        this.audio.addEventListener('volumechange', () => {
            this.state.volume = this.audio.volume;
            this.notifyStateChanged();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.state.isPlaying = false;
            this.state.isLoaded = false;
            this.notifyStateChanged();
        });
    }

    notifyStateChanged() {
        if (this.dotNetRef) {
            this.dotNetRef.invokeMethodAsync('OnStateChanged', this.state);
        }
    }

    initialize(dotNetRef) {
        this.dotNetRef = dotNetRef;
    }

    loadTrack(filePath) {
        this.audio.src = filePath;
        this.state.currentTrack = filePath;
        this.state.isLoaded = false;
        this.state.currentTime = 0;
        this.notifyStateChanged();
    }

    play() {
        if (this.audio.src) {
            this.audio.play().catch(e => {
                console.error('Play failed:', e);
            });
        }
    }

    pause() {
        this.audio.pause();
    }

    setVolume(volume) {
        this.audio.volume = Math.max(0, Math.min(1, volume));
    }

    seek(position) {
        if (this.audio.duration) {
            this.audio.currentTime = position;
        }
    }

    getState() {
        return this.state;
    }
}

// Global instance
window.audioPlayerManager = new AudioPlayerManager();

// Export functions for Blazor
export function initialize(dotNetRef) {
    window.audioPlayerManager.initialize(dotNetRef);
}

export function loadTrack(filePath) {
    window.audioPlayerManager.loadTrack(filePath);
}

export function play() {
    window.audioPlayerManager.play();
}

export function pause() {
    window.audioPlayerManager.pause();
}

export function setVolume(volume) {
    window.audioPlayerManager.setVolume(volume);
}

export function seek(position) {
    window.audioPlayerManager.seek(position);
}

export function getState() {
    return window.audioPlayerManager.getState();
}