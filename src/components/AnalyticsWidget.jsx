
import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LabelList } from 'recharts';
import { PieChart as PieIcon, BarChart3, Hexagon, Table as TableIcon } from 'lucide-react';
import { cn } from '../lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const AnalyticsWidget = ({ title, icon: Icon, data, totalValue, formatMoney, colorClass, customControls }) => {
    const [viewType, setViewType] = useState('pie'); // pie, bar, radar, table

    // Spider Label for Pie Chart (Like the user's image)
    const renderCustomizedLabel = (props) => {
        const { cx, cy, midAngle, outerRadius, percent, name, value, fill } = props;
        const RADIAN = Math.PI / 180;

        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        const sx = cx + (outerRadius + 0) * cos;
        const sy = cy + (outerRadius + 0) * sin;
        const mx = cx + (outerRadius + 20) * cos;
        const my = cy + (outerRadius + 20) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 12; // Shorten the horizontal line
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';

        // Hide if segment is very small to prevent overlap clumping
        if (percent < 0.05) return null;

        return (
            <g>
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
                <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
                {/* Line 1: Name */}
                <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey - 6} textAnchor={textAnchor} fill="#333" dominantBaseline="central" fontSize={11} className="fill-foreground font-bold">
                    {name}
                </text>
                {/* Line 2: Amount (Percent%) */}
                <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey + 10} textAnchor={textAnchor} fill="#333" fontSize={10} className="fill-foreground font-medium">
                    {`${formatMoney(value)} (${(percent * 100).toFixed(0)}%)`}
                </text>
            </g>
        );
    };

    const renderContent = () => {
        if (!data || data.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <p>No data available for this period.</p>
                </div>
            );
        }

        switch (viewType) {
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={45} // Reduced from 50
                                outerRadius={65} // Reduced from 80 to prevent clipping
                                paddingAngle={5}
                                dataKey="value"
                                label={renderCustomizedLabel}
                                labelLine={false}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => formatMoney(value)}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            {/* Legend Removed as per user request to have info 'inside/overlay' via labels */}
                        </PieChart>
                    </ResponsiveContainer>
                );
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip
                                formatter={(value) => formatMoney(value)}
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                ))}
                                <LabelList dataKey="value" position="right" formatter={(val) => formatMoney(val)} style={{ fontSize: '11px', fontWeight: 'bold', fill: 'hsl(var(--foreground))' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'radar':
                return (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} hide />
                            <Radar name={title} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                            <Tooltip
                                formatter={(value) => formatMoney(value)}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                );
            case 'table':
                return (
                    <div className="h-full overflow-auto pr-2">
                        <table className="w-full text-sm text-left">
                            <thead className="text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="pb-2">Category</th>
                                    <th className="pb-2 text-right">Amount</th>
                                    <th className="pb-2 text-right pr-2">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data.map((item, index) => {
                                    const percentage = ((item.value / totalValue) * 100).toFixed(1);
                                    return (
                                        <tr key={index} className="group hover:bg-muted/50 transition-colors">
                                            <td className="py-3 flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }} />
                                                {item.name}
                                            </td>
                                            <td className="py-3 text-right font-medium">{formatMoney(item.value)}</td>
                                            <td className="py-3 text-right pr-2 text-muted-foreground">{percentage}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    {Icon && <Icon className={cn("w-5 h-5", colorClass)} />}
                    {title}
                </h2>
                <div className="flex items-center gap-2">
                    {/* Custom Controls (e.g. Toggles) */}
                    {customControls && (
                        <div className="mr-2">
                            {customControls}
                        </div>
                    )}

                    <div className="flex bg-muted p-1 rounded-lg">
                        <button onClick={() => setViewType('pie')} className={cn("p-1.5 rounded-md transition-all", viewType === 'pie' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")} title="Pie Chart">
                            <PieIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewType('bar')} className={cn("p-1.5 rounded-md transition-all", viewType === 'bar' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")} title="Bar Chart">
                            <BarChart3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewType('radar')} className={cn("p-1.5 rounded-md transition-all", viewType === 'radar' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")} title="Radar Chart">
                            <Hexagon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewType('table')} className={cn("p-1.5 rounded-md transition-all", viewType === 'table' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")} title="Table View">
                            <TableIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                {renderContent()}
            </div>

        </div>
    );
};

export default AnalyticsWidget;
