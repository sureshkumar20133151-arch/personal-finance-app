
import { useFinance } from '../context/FinanceContext';

// Backward compatibility hook
// This ensures we don't have to refactor every single file that imports useFinanceData
export function useFinanceData() {
    const context = useFinance();
    if (context === undefined) {
        throw new Error('useFinanceData must be used within a FinanceProvider');
    }
    return context;
}
