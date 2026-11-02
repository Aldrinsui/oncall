import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
}

export default function AudioVisualizer({
  analyser,
  isActive,
  color = '#1d9e75',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 32);

    const render = () => {
      animationFrameId.current = requestAnimationFrame(render);

      if (analyser && isActive) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Simulated idle ambient wave
        const time = Date.now() / 200;
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = isActive ? Math.sin(time + i * 0.4) * 30 + 35 : 10;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 1.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

        // Gradient bar
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, '#5dcaa5');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        x += barWidth;
      }
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyser, isActive, color]);

  return (
    <div className="flex items-center gap-2 bg-og-night/80 px-3 py-1.5 rounded-lg border border-og-night-border">
      <span className="text-[10px] font-bold text-og-green-light uppercase tracking-wider flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-og-green animate-pulse-dot" />
        Audio Frequency
      </span>
      <canvas
        ref={canvasRef}
        width={140}
        height={24}
        className="w-[140px] h-[24px]"
      />
    </div>
  );
}
