export {}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string
          width?: string | number
          height?: string | number
          playerVars?: Record<string, string | number>
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void
            onStateChange?: (event: { data: number; target: YouTubePlayer }) => void
            onError?: (event: { data: number; target: YouTubePlayer }) => void
          }
        },
      ) => YouTubePlayer
      PlayerState: {
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
        UNSTARTED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }

  interface YouTubePlayer {
    playVideo: () => void
    pauseVideo: () => void
    stopVideo: () => void
    destroy: () => void
    getCurrentTime: () => number
    getDuration: () => number
  }
}
