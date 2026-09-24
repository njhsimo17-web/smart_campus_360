import { BellRing, ArrowRight, Clock3 } from 'lucide-react';
import type { LiveEvent } from '../data/mock';

interface LiveTimelineProps {
  events: LiveEvent[];
  tone?: 'dark' | 'light';
}

export function LiveTimeline({ events, tone = 'dark' }: LiveTimelineProps) {
  const shell = tone === 'dark'
    ? 'border-slate-800 bg-slate-900/80 shadow-slate-950/30'
    : 'border-slate-200 bg-white/90 shadow-slate-200/70';
  const muted = tone === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const strong = tone === 'dark' ? 'text-white' : 'text-slate-900';
  const row = tone === 'dark' ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50';

  return (
    <div className={`rounded-3xl border p-6 shadow-lg ${shell}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className={`text-sm ${muted}`}>Live event stream</p>
          <h3 className={`text-xl font-semibold ${strong}`}>RFID timeline</h3>
        </div>
        <BellRing className="text-cyan-400" />
      </div>
      <div className="space-y-4">
        {events.map((event) => (
          <div key={event.id} className={`flex items-center justify-between rounded-3xl border px-4 py-4 ${row}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${event.color}`}>
                <Clock3 size={18} className="text-slate-950" />
              </div>
              <div>
                <p className={`font-semibold ${strong}`}>{event.name}</p>
                <p className={`text-sm ${muted}`}>{event.event} • {event.room}</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm ${muted}`}>
              <span>{event.time}</span>
              <ArrowRight size={16} className="text-slate-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
