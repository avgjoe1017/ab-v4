import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";

if (ffmpegStatic) {
    console.log(`Using ffmpeg: ${ffmpegStatic}`);
    ffmpeg.setFfmpegPath(ffmpegStatic);
} else {
    console.error("ffmpeg-static not found!");
}

async function testGen(file: string) {
    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input("anullsrc=r=44100:cl=stereo")
            .inputFormat("lavfi")
            .duration(1)
            .outputOptions("-c:a libmp3lame", "-b:a 128k")
            .save(file)
            .on("start", (cmd) => console.log("Running:", cmd))
            .on("end", () => { console.log("Success!"); resolve(); })
            .on("error", (err) => { console.error("Error:", err); reject(err); });
    });
}

testGen("debug_out.mp3").catch(console.error);
