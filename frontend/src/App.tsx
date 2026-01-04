import { useState, useEffect, useRef } from 'react'
import { Upload, FileAudio, Check, AlertCircle, Terminal, Play, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

// Simplified Component Architecture for the "Studio" feel

export default function App() {
    const [status, setStatus] = useState("idle") // idle, uploading, processing, complete, error
    const [progress, setProgress] = useState(0)
    const [statusMsg, setStatusMsg] = useState("Ready")
    const [taskId, setTaskId] = useState<string | null>(null)
    const [transcript, setTranscript] = useState<any>(null)

    // Settings
    const [modelSize, setModelSize] = useState("large-v3")
    const [diarize, setDiarize] = useState(false)
    const [hfToken, setHfToken] = useState("")

    useEffect(() => {
        // Check system status on load
        fetch('/api/system/status')
            .then(res => res.json())
            .then(data => {
                console.log("System Status:", data)
            })
            .catch(err => console.error("API connect error", err))
    }, [])

    useEffect(() => {
        if (!taskId) return

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/transcribe/ws/${taskId}`
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
        } catch (err) {
            setStatus("error")
            setStatusMsg("Upload failed")
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-8 font-sans">
            <header className="w-full max-w-5xl flex justify-between items-center mb-12">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    WhisperX Studio
                </h1>
                <div className="flex gap-2 text-sm text-muted-foreground">
                    <span>v1.0.0</span>
                    {status === "processing" && <span className="animate-pulse text-yellow-500">● Processing</span>}
                </div>
            </header>

            <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">

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
                            disabled={status === "processing"}
                        />
                        <div className={cn(
                            "border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 text-center transition-all group-hover:border-primary/50 group-hover:bg-secondary/50",
                            status === "processing" && "opacity-50 pointer-events-none"
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
                    {(status === "uploading" || status === "processing" || statusMsg !== "Ready") && (
                        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="font-mono">{statusMsg}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
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
                                <button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded hover:opacity-90">
                                    Export SRT
                                </button>
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
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                {seg.speaker}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed text-foreground/90">
                                            {seg.text}
                                        </p>
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

            </main>
        </div>
    )
}

function formatTime(s: number) {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}
