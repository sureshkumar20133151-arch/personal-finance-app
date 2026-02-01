import React from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '../lib/utils';

const CategoryIcon = ({ iconName, color, className, size = 20 }) => {
    // 1. Try to find the icon in Lucide
    // Capitalize first letter just in case, though usually names are PascalCase
    const IconComponent = LucideIcons[iconName];

    // 2. Fallback: If iconName is actually an emoji (legacy support), render it as text
    const isEmoji = (str) => {
        const ranges = [
            '\ud83c[\udf00-\udfff]', // U+1F300 to U+1F3FF
            '\ud83d[\udc00-\ude4f]', // U+1F400 to U+1F64F
            '\ud83d[\ude80-\udeff]'  // U+1F680 to U+1F6FF
        ];
        if (str && str.match && str.match(ranges.join('|'))) {
            return true;
        }
        // Simple length check for single char emoji or simple string
        return str && str.length <= 2 && !/[a-zA-Z]/.test(str);
    };

    if (!IconComponent) {
        if (isEmoji(iconName)) {
            return (
                <span className={cn("flex items-center justify-center font-emoji loading-none", className)} style={{ fontSize: size }}>
                    {iconName}
                </span>
            );
        }
        // Final fallback: Use a generic icon
        const Fallback = LucideIcons.CircleHelp;
        return <Fallback className={cn("", className)} size={size} color={color} />;
    }

    return <IconComponent className={cn("", className)} size={size} color={color} strokeWidth={2} />;
};

export default CategoryIcon;
