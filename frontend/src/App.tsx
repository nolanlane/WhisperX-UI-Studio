import { useState, useEffect } from 'react'
import { Upload, FileAudio, Terminal, Settings, Layers, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import Toolbox from './Toolbox'

export default function App() {
    const [activeTab, setActiveTab] = useState<"studio" | "toolbox">("studio")
    const [systemStatus, setSystemStatus] = useState<any>(null)

    // Transcription State
    const [status, setStatus] = useState("idle")
    const [progress, setProgress] = useState(0)
    const [statusMsg, setStatusMsg] = useState("Ready")
    const [taskId, setTaskId] = useState<string | null>(null)
    const [transcript, setTranscript] = useState<any>(null)

    // Settings
    const [modelSize, setModelSize] = useState("large-v3")
    const [diarize, setDiarize] = useState(false)
    const [hfToken, setHfToken] = useState("")

    useEffect(() => {
        // Poll system status every 5 seconds
        const pollStatus = async () => {
            try {
                const res = await fetch('/api/system/status')
                const data = await res.json()
                setSystemStatus(data)
            } catch (err) {
                console.error("Status poll error", err)
            }
        }
        pollStatus()
        const interval = setInterval(pollStatus, 5000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!taskId) return

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/ws/${taskId}`
        const ws = new WebSocket(wsUrl)

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            console.log("WS Update:", data)

            if (data.status) setStatus(data.status)
            if (data.progress) setProgress(data.progress)
            if (data.message) setStatusMsg(data.message)
            if (data.result) setTranscript(data.result)
            if (data.error) {
                setStatus("error")
                setStatusMsg(data.error)
            }
        }

        return () => ws.close()
    }, [taskId])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setStatus("uploading")
        setStatusMsg("Uploading file...")
        setTranscript(null)

        const formData = new FormData()
        formData.append("file", file)
        formData.append("model_size", modelSize)
        formData.append("diarize", String(diarize))
        formData.append("hf_token", hfToken)

        try {
            const res = await fetch("/api/transcribe/upload", {
                method: "POST",
                body: formData
            })
            const data = await res.json()
            setTaskId(data.task_id)
            if (data.status === "queued") {
                setStatus("queued")
                setStatusMsg("Queued for processing...")
            }
        } catch (err) {
            setStatus("error")
            setStatusMsg("Upload failed")
        }
    }

    const exportTranscript = (format: "srt" | "vtt" | "txt") => {
        if (!transcript) return

        let content = ""
        if (format === "txt") {
            content = transcript.segments.map((s: any) => `[${s.speaker}] ${s.text}`).join("\n")
        } else {
            // Simple SRT/VTT generator
            content = transcript.segments.map((s: any, i: number) => {
                const start = formatTimeDetailed(s.start, format === "srt")
                const end = formatTimeDetailed(s.end, format === "srt")
                return format === "srt"
                    ? `${i+1}\n${start} --> ${end}\n[${s.speaker}] ${s.text}\n`
                    : `${start} --> ${end}\n<v ${s.speaker}>${s.text}`
            }).join("\n\n")

            if (format === "vtt") content = "WEBVTT\n\n" + content
        }

        const blob = new Blob([content], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `transcript.${format}`
        document.body.appendChild(a)
        a.click()
        a.remove()
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-8 font-sans">
            <header className="w-full max-w-5xl flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        WhisperX Studio
                    </h1>
                    <div className="flex gap-2 text-sm text-muted-foreground mt-1">
                        <span>v1.0.0</span>
                        {systemStatus?.gpu?.available && (
                            <span className="flex items-center gap-1 text-green-500">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                {systemStatus.gpu.name} ({systemStatus.gpu.vram_free}GB Free)
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 bg-secondary/50 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab("studio")}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === "studio" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Layers className="w-4 h-4" /> Studio
                    </button>
                    <button
                        onClick={() => setActiveTab("toolbox")}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === "toolbox" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Wrench className="w-4 h-4" /> Toolbox
                    </button>
                </div>
            </header>

            <main className="w-full max-w-5xl">
                {activeTab === "toolbox" ? (
                    <Toolbox />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Panel: Settings & Upload */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
                                <h2 className="flex items-center gap-2 font-semibold">
                                    <Settings className="w-4 h-4" /> Configuration
                                </h2>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium uppercase text-muted-foreground">Model Size</label>
                                    <select
                                        className="w-full bg-secondary rounded-md p-2 text-sm border-none focus:ring-1 focus:ring-primary"
                                        value={modelSize}
                                        onChange={(e) => setModelSize(e.target.value)}
                                    >
                                        <option value="base">Base (Fast)</option>
                                        <option value="small">Small</option>
                                        <option value="medium">Medium</option>
                                        <option value="large-v3">Large v3 (Best)</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="text-sm">Speaker Diarization</label>
                                    <input
                                        type="checkbox"
                                        checked={diarize}
                                        onChange={(e) => setDiarize(e.target.checked)}
                                        className="toggle"
                                    />
                                </div>

                                {diarize && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">HF Token</label>
                                        <input
                                            type="password"
                                            value={hfToken}
                                            onChange={(e) => setHfToken(e.target.value)}
                                            className="w-full bg-secondary rounded-md p-2 text-sm"
                                            placeholder="hf_..."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="relative group cursor-pointer">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={handleFileUpload}
                                    accept="audio/*,video/*"
                                    disabled={status === "processing" || status === "queued"}
                                />
                                <div className={cn(
                                    "border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 text-center transition-all group-hover:border-primary/50 group-hover:bg-secondary/50",
                                    (status === "processing" || status === "queued") && "opacity-50 pointer-events-none"
                                )}>
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-4 rounded-full bg-secondary shadow-inner">
                                            <Upload className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Drop media file here</p>
                                            <p className="text-xs text-muted-foreground mt-1">Supports MP3, WAV, MP4, MKV</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Panel: Output & Status */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Progress Bar */}
                            {(status !== "idle" && statusMsg !== "Ready") && (
                                <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                                    <div className="flex justify-between items-center mb-2 text-sm">
                                        <span className="font-mono flex items-center gap-2">
                                            {status === "queued" && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>}
                                            {status === "processing" && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                                            {statusMsg}
                                        </span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full transition-all duration-500 ease-out",
                                                status === "queued" ? "bg-yellow-500 w-full animate-pulse opacity-50" : "bg-blue-500"
                                            )}
                                            style={{ width: status === "queued" ? "100%" : `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Transcript View */}
                            <div className="min-h-[500px] p-6 rounded-xl border border-border bg-card shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <Terminal className="w-4 h-4" />
                                        Transcript
                                    </h3>
                                    {transcript && (
                                        <div className="flex gap-2">
                                            <button onClick={() => exportTranscript('txt')} className="text-xs bg-secondary hover:bg-secondary/80 px-3 py-1 rounded">TXT</button>
                                            <button onClick={() => exportTranscript('srt')} className="text-xs bg-secondary hover:bg-secondary/80 px-3 py-1 rounded">SRT</button>
                                            <button onClick={() => exportTranscript('vtt')} className="text-xs bg-secondary hover:bg-secondary/80 px-3 py-1 rounded">VTT</button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px] pr-2 custom-scrollbar">
                                    {transcript ? (
                                        transcript.segments.map((seg: any, i: number) => (
                                            <div key={i} className="group hover:bg-secondary/30 p-2 rounded -mx-2 transition-colors">
                                                <div className="flex items-baseline gap-4 mb-1">
                                                    <span className="text-xs font-mono text-blue-400">
                                                        {formatTime(seg.start)}
                                                    </span>
                                                    <input
                                                        className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-transparent border-none focus:ring-0 p-0 w-24"
                                                        value={seg.speaker}
                                                        onChange={(e) => {
                                                            const newSegs = [...transcript.segments];
                                                            newSegs[i].speaker = e.target.value;
                                                            setTranscript({ ...transcript, segments: newSegs });
                                                        }}
                                                    />
                                                </div>
                                                <textarea
                                                    className="text-sm leading-relaxed text-foreground/90 w-full bg-transparent border-none resize-none focus:ring-0 p-0"
                                                    value={seg.text}
                                                    onChange={(e) => {
                                                        const newSegs = [...transcript.segments];
                                                        newSegs[i].text = e.target.value;
                                                        setTranscript({ ...transcript, segments: newSegs });
                                                    }}
                                                    rows={Math.ceil(seg.text.length / 80)}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-20">
                                            <FileAudio className="w-16 h-16 mb-4" />
                                            <p>No transcript generated yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

function formatTime(s: number) {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function formatTimeDetailed(s: number, srt: boolean) {
    const date = new Date(s * 1000)
    const hh = date.getUTCHours().toString().padStart(2, '0')
    const mm = date.getUTCMinutes().toString().padStart(2, '0')
    const ss = date.getUTCSeconds().toString().padStart(2, '0')
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0')
    return srt ? `${hh}:${mm}:${ss},${ms}` : `${hh}:${mm}:${ss}.${ms}`
}
