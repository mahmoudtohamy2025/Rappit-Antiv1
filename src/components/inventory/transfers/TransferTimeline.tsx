/**
 * Transfer Timeline Component
 * Status timeline for a transfer request
 * 
 * Part of: UI-INV-06 (Backend: transfer-reservation.service.ts)
 */

import {
    CheckCircle2,
    Clock,
    User
} from 'lucide-react';

interface TimelineEvent {
    status: string;
    label: string;
    by?: string;
    at: string;
}

interface TransferTimelineProps {
    events: TimelineEvent[];
}

export function TransferTimeline({ events }: TransferTimelineProps) {
    if (events.length === 0) return null;

    return (
        <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                الجدول الزمني
            </h4>

            <div className="space-y-3">
                {events.map((event, index) => (
                    <div key={index} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            {index < events.length - 1 && (
                                <div className="w-0.5 flex-1 bg-green-200 dark:bg-green-800 my-1" />
                            )}
                        </div>
                        <div className="flex-1 pb-3">
                            <p className="font-medium text-sm">{event.label}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {event.by && (
                                    <>
                                        <User className="w-3 h-3" />
                                        <span>{event.by}</span>
                                        <span>•</span>
                                    </>
                                )}
                                <span>{event.at}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
