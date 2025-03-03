"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Calendar, Send, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { getJournalEntriesByDate, createJournalEntry, deleteJournalEntry } from "@/api/journal.api";
import { analyzeJournalEntry } from "@/api/ai.api";
import { DatePicker } from "@/components/ui/date-picker";

// Define a simple JournalEntry type until we can properly import from @repo/db
interface JournalEntry {
  id: number;
  content: string;
  date: string;
  userId: string;
}

// Define the type for creating a journal entry
interface CreateJournalEntryParams {
  content: string;
  date: string;
}

// Define the type for the response from createJournalEntry
interface JournalEntryResponse {
  id: number;
  content: string;
  date: string;
  userId: string;
  [key: string]: unknown;
}

export function JournalView() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newEntry, setNewEntry] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Format the selected date for API requests
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  
  // Fetch journal entries for the selected date
  const { 
    data: journalEntries = [] as JournalEntry[], 
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ["journalEntries", formattedDate],
    queryFn: () => getJournalEntriesByDate(formattedDate)
  });
  
  // Create a new journal entry
  const createEntryMutation = useMutation({
    mutationFn: (params: CreateJournalEntryParams) => createJournalEntry(params),
    onSuccess: async (data: JournalEntryResponse) => {
      // Invalidate the journal entries query to refetch
      queryClient.invalidateQueries({ queryKey: ["journalEntries", formattedDate] });
      
      // Clear the input field
      setNewEntry("");
      
      // Analyze the new entry with AI
      try {
        if (data && data.id) {
          await analyzeJournalEntry(data.id);
          // Invalidate priorities to show newly extracted priorities
          queryClient.invalidateQueries({ queryKey: ["priorities", formattedDate] });
          // Invalidate clarifying questions
          queryClient.invalidateQueries({ queryKey: ["clarifyingQuestions"] });
        }
      } catch (error) {
        console.error("Error analyzing journal entry:", error);
      }
      
      toast.success("Journal entry added");
      
      // Focus the textarea for continuous journaling
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    onError: (error) => {
      console.error("Error creating journal entry:", error);
      toast.error("Failed to add journal entry");
    }
  });
  
  // Delete a journal entry
  const deleteEntryMutation = useMutation({
    mutationFn: deleteJournalEntry,
    onSuccess: () => {
      // Invalidate the journal entries query to refetch
      queryClient.invalidateQueries({ queryKey: ["journalEntries", formattedDate] });
      toast.success("Journal entry deleted");
    },
    onError: (error) => {
      console.error("Error deleting journal entry:", error);
      toast.error("Failed to delete journal entry");
    }
  });
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEntry.trim()) {
      toast.error("Journal entry cannot be empty");
      return;
    }
    
    createEntryMutation.mutate({
      content: newEntry,
      date: formattedDate // Use the formatted date string
    });
  };
  
  // Handle entry deletion
  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      deleteEntryMutation.mutate(id);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (newEntry.trim()) {
        handleSubmit(e);
      }
    }
  };
  
  return (
    <div className="space-y-8">
      {/* New entry form - always visible and prominent */}
      <Card className="border-2 border-primary/20 shadow-md">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              ref={textareaRef}
              placeholder="What's on your mind today? Just start typing..."
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[120px] text-base border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 placeholder:text-muted-foreground/70 resize-none"
              autoFocus
            />
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Press Ctrl+Enter to save
              </div>
              <Button 
                type="submit" 
                disabled={createEntryMutation.isPending || !newEntry.trim()}
                className="flex items-center gap-2"
              >
                {createEntryMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Add Entry
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Date selector and entries header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">Journal Entries</h2>
        <DatePicker
          date={selectedDate}
          setDate={setSelectedDate}
          className="w-[240px]"
        />
      </div>
      
      <Separator />
      
      {/* Journal entries list */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-destructive">
            Error loading journal entries: {error?.message || "Unknown error"}
          </div>
        ) : journalEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="mb-2">No journal entries for {format(selectedDate, "MMMM d, yyyy")}</div>
            <div className="text-sm">Start writing above to capture your thoughts</div>
          </div>
        ) : (
          <div>
            <div className="text-sm text-muted-foreground mb-4">
              {journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'} for {format(selectedDate, "MMMM d, yyyy")}
            </div>
            {journalEntries.map((entry) => (
              <Card key={entry.id} className="relative group mb-6 border-0 shadow-sm bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                    <span>{format(new Date(entry.date), "h:mm a")}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-base">{entry.content}</div>
                </CardContent>
              </Card>
            ))}
            
            {journalEntries.length > 5 && (
              <div className="flex justify-center mt-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground flex items-center gap-1">
                  <ChevronDown className="size-4" />
                  <span>Show more</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 