import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

const ClockWidget = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center py-4 mb-2 mx-2">
            <h2 className="text-4xl font-black tabular-nums tracking-tight text-foreground">
                {format(time, 'h:mm')} <span className="text-lg font-bold text-muted-foreground ml-0.5">{format(time, 'a')}</span>
            </h2>
            <div className="text-center mt-1">
                <p className="text-base font-bold text-foreground/80">
                    {format(time, 'EEEE')}
                </p>
                <p className="text-xs text-muted-foreground">
                    {format(time, 'MMMM d, yyyy')}
                </p>
            </div>
        </div>
    );
};

export default ClockWidget;
