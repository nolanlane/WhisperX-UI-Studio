import { useState } from 'react'
import { RefreshCw, Flame, ArrowRight, X, AlertCircle, Music } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Toolbox() {
    const [activeTool, setActiveTool] = useState<"convert" | "burn" | "extract">("convert")
    const [status, setStatus] = useState("idle")
    const [statusMsg, setStatusMsg] = useState("")
    const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; details: string }>({ open: false, title: "", details: "" })

    return (
        <div className="space-y-8">
            <div className="flex gap-4 border-b border-border pb-4">
                <button
                    onClick={() => setActiveTool("convert")}
                    className={cn(
                        "px-4 py-2 rounded-lg flex items-center gap-2 transition-colors",
                        activeTool === "convert" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    )}
                >
                    <RefreshCw className="w-4 h-4" /> Convert Video
                </button>
                <button
                    onClick={() => setActiveTool("burn")}
                    className={cn(
                        "px-4 py-2 rounded-lg flex items-center gap-2 transition-colors",
                        activeTool === "burn" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    )}
                >
                    <Flame className="w-4 h-4" /> Burn Subtitles
                </button>
                <button
                    onClick={() => setActiveTool("extract")}
                    className={cn(
                        "px-4 py-2 rounded-lg flex items-center gap-2 transition-colors",
                        activeTool === "extract" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    )}
                >
                    <Music className="w-4 h-4" /> Extract Audio
                </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-8">
                {activeTool === "convert" ? (
                    <ConvertTool status={status} setStatus={setStatus} setStatusMsg={setStatusMsg} setErrorModal={setErrorModal} />
                ) : activeTool === "burn" ? (
                    <BurnTool status={status} setStatus={setStatus} setStatusMsg={setStatusMsg} setErrorModal={setErrorModal} />
                ) : (
                    <ExtractTool status={status} setStatus={setStatus} setStatusMsg={setStatusMsg} setErrorModal={setErrorModal} />
                )}

                {statusMsg && (
                    <div className={cn("mt-4 p-4 rounded-lg", status === "error" ? "bg-red-500/10 text-red-500" : "bg-secondary text-secondary-foreground")}>
                        {statusMsg}
                    </div>
                )}
            </div>

            {/* Error Modal */}
            {errorModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <h3 className="text-lg font-semibold">{errorModal.title}</h3>
                            </div>
                            <button
                                onClick={() => setErrorModal({ open: false, title: "", details: "" })}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-muted-foreground mb-4">FFmpeg encountered an error. Details below:</p>
                            <pre className="bg-secondary p-4 rounded-lg text-xs overflow-auto max-h-64 text-red-400">
                                {errorModal.details}
                            </pre>
                        </div>
                        <div className="p-6 border-t border-border">
                            <button
                                onClick={() => setErrorModal({ open: false, title: "", details: "" })}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ConvertTool({ status, setStatus, setStatusMsg, setErrorModal }: any) {
    const [file, setFile] = useState<File | null>(null)
    const [format, setFormat] = useState("mp4")
    const [codec, setCodec] = useState("libx264")

    const handleConvert = async () => {
        if (!file) return
        setStatus("processing")
        setStatusMsg("Converting video...")

        const formData = new FormData()
        formData.append("file", file)

        // Construct query params
        const url = `/api/toolbox/convert?format=${format}&codec=${codec}`

        try {
            const res = await fetch(url, { method: "POST", body: formData })
            
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.details || "Conversion failed")
            }

            // Trigger download
            const blob = await res.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = downloadUrl
            a.download = `converted_${file.name.split('.')[0]}.${format}`
            document.body.appendChild(a)
            a.click()
            a.remove()

            setStatus("idle")
            setStatusMsg("Conversion complete! Download started.")
        } catch (e: any) {
            setStatus("error")
            setStatusMsg("Error during conversion.")
            if (e.message && e.message.includes("FFmpeg")) {
                setErrorModal({ open: true, title: "Video Conversion Error", details: e.message })
            }
        }
    }

    return (
        <div className="space-y-6 max-w-xl">
            <h3 className="text-xl font-semibold">Video Converter</h3>

            <div className="space-y-2">
                <label className="text-sm font-medium">Input File</label>
                <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-violet-50 file:text-violet-700
                        hover:file:bg-violet-100"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Output Format</label>
                    <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        className="w-full bg-secondary rounded p-2"
                    >
                        <option value="mp4">MP4</option>
                        <option value="mkv">MKV</option>
                        <option value="mov">MOV</option>
                        <option value="mp3">MP3 (Audio Only)</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Codec</label>
                    <select
                        value={codec}
                        onChange={(e) => setCodec(e.target.value)}
                        className="w-full bg-secondary rounded p-2"
                    >
                        <option value="libx264">x264 (CPU - Compatible)</option>
                        <option value="h264_nvenc">NVENC (GPU - Fast)</option>
                    </select>
                </div>
            </div>

            <button
                onClick={handleConvert}
                disabled={!file || status === "processing"}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
                {status === "processing" ? "Converting..." : "Start Conversion"}
            </button>
        </div>
    )
}

function BurnTool({ status, setStatus, setStatusMsg, setErrorModal }: any) {
    const [video, setVideo] = useState<File | null>(null)
    const [sub, setSub] = useState<File | null>(null)

    const handleBurn = async () => {
        if (!video || !sub) return
        setStatus("processing")
        setStatusMsg("Burning subtitles... This may take a while.")

        const formData = new FormData()
        formData.append("video", video)
        formData.append("subtitle", sub)

        try {
            const res = await fetch("/api/toolbox/burn_subtitles", { method: "POST", body: formData })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.details || "Failed")
            }

            const blob = await res.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = downloadUrl
            a.download = `subtitled_${video.name}`
            document.body.appendChild(a)
            a.click()
            a.remove()

            setStatus("idle")
            setStatusMsg("Done! Download started.")
        } catch (e: any) {
            setStatus("error")
            setStatusMsg("Error: " + e.message)
            if (e.message && e.message.includes("FFmpeg")) {
                setErrorModal({ open: true, title: "Subtitle Burning Error", details: e.message })
            }
        }
    }

    return (
        <div className="space-y-6 max-w-xl">
            <h3 className="text-xl font-semibold">Burn Subtitles (Hardsub)</h3>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Video File</label>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => setVideo(e.target.files?.[0] || null)}
                        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-secondary"
                    />
                </div>

                <div className="flex justify-center">
                    <ArrowRight className="text-muted-foreground" />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Subtitle File (.srt, .vtt, .ass)</label>
                    <input
                        type="file"
                        accept=".srt,.vtt,.ass"
                        onChange={(e) => setSub(e.target.files?.[0] || null)}
                        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-secondary"
                    />
                </div>
            </div>

            <button
                onClick={handleBurn}
                disabled={!video || !sub || status === "processing"}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 w-full"
            >
                {status === "processing" ? "Processing..." : "Burn Subtitles"}
            </button>
        </div>
    )
}

function ExtractTool({ status, setStatus, setStatusMsg, setErrorModal }: any) {
    const [file, setFile] = useState<File | null>(null)
    const [format, setFormat] = useState("mp3")

    const handleExtract = async () => {
        if (!file) return
        setStatus("processing")
        setStatusMsg("Extracting audio...")

        const formData = new FormData()
        formData.append("file", file)

        const url = `/api/toolbox/extract_audio?format=${format}`

        try {
            const res = await fetch(url, { method: "POST", body: formData })
            
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.details || "Extraction failed")
            }

            const blob = await res.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = downloadUrl
            a.download = `audio_${file.name.split('.')[0]}.${format}`
            document.body.appendChild(a)
            a.click()
            a.remove()

            setStatus("idle")
            setStatusMsg("Extraction complete! Download started.")
        } catch (e: any) {
            setStatus("error")
            setStatusMsg("Error during extraction.")
            if (e.message && e.message.includes("FFmpeg")) {
                setErrorModal({ open: true, title: "Audio Extraction Error", details: e.message })
            }
        }
    }

    return (
        <div className="space-y-6 max-w-xl">
            <h3 className="text-xl font-semibold">Extract Audio</h3>

            <div className="space-y-2">
                <label className="text-sm font-medium">Video File</label>
                <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-secondary"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Audio Format</label>
                <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full bg-secondary rounded p-2"
                >
                    <option value="mp3">MP3</option>
                    <option value="aac">AAC</option>
                </select>
            </div>

            <button
                onClick={handleExtract}
                disabled={!file || status === "processing"}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
                {status === "processing" ? "Extracting..." : "Extract Audio"}
            </button>
        </div>
    )
}
