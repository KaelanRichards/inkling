import { JournalView } from "./_components/journal-view";
import { PrioritiesPanel } from "./_components/priorities-panel";
import { ClarifyingQuestionsPanel } from "./_components/clarifying-questions-panel";

export default function JournalPage() {
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8 text-primary">Inkling</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main journal area - takes up 3/4 of the space on larger screens */}
        <div className="lg:col-span-3 space-y-8">
          <JournalView />
        </div>
        
        {/* Sidebar for priorities and clarifying questions - takes up 1/4 of the space */}
        <div className="space-y-8">
          <PrioritiesPanel />
          <ClarifyingQuestionsPanel />
        </div>
      </div>
    </div>
  );
} 