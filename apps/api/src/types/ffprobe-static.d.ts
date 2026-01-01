/**
 * Type declarations for ffprobe-static package
 * This package provides a static binary path for ffprobe
 */

declare module "ffprobe-static" {
  interface FfprobeStatic {
    path: string;
  }

  const ffprobeStatic: FfprobeStatic;
  export default ffprobeStatic;
}
