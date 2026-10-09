import { History } from 'lucide-react';

export default function HistoryTab() {
  return (
    <section className="animate-in">
      <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground/30">
          <History className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">No scan history</h4>
          <p className="text-xs text-muted-foreground px-8 mt-1">Your past scan results will appear here.</p>
        </div>
      </div>
    </section>
  );
}
