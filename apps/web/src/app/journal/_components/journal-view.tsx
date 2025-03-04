"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
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

// Define pagination parameters
interface PaginationParams {
  date: string;
  limit: number;
  offset: number;
}

export function JournalView() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newEntry, setNewEntry] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Format the selected date for API requests
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  
  // Fetch journal entries for the selected date with infinite query
  const { 
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ["journalEntries", formattedDate],
    queryFn: async ({ pageParam = 0 }) => {
      return getJournalEntriesByDate(formattedDate, 10, pageParam);
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we got fewer entries than the limit, there are no more pages
      return lastPage.length === 10 ? allPages.flat().length : undefined;
    },
    initialPageParam: 0
  });
  
  // Flatten the pages of entries
  const journalEntries = data?.pages.flat() || [];
  
  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (loadMoreRef.current && hasNextPage) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { threshold: 0.5 }
      );
      
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreRef.current, hasNextPage, isFetchingNextPage, fetchNextPage]);
  
  // Reset pagination when date changes
  useEffect(() => {
    // Reset the query when the date changes
    queryClient.resetQueries({ queryKey: ["journalEntries", formattedDate] });
  }, [formattedDate, queryClient]);
  
  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newEntry]);

  // Auto-focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
  // Create a new journal entry
  const createEntryMutation = useMutation({
    mutationFn: (data: CreateJournalEntryParams) => createJournalEntry(data),
    onSuccess: (data: JournalEntryResponse) => {
      // Invalidate the journal entries query to refetch
      queryClient.invalidateQueries({ queryKey: ["journalEntries", formattedDate] });
      
      // Clear the input field
      setNewEntry("");
      
      // Analyze the new entry with AI
      analyzeEntryMutation.mutate(data.id);
      
      // Reset the textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      
      // Auto-focus the textarea after submission
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
      
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Error creating journal entry:", error);
      toast.error("Failed to save journal entry");
      setIsSubmitting(false);
    }
  });
  
  // Analyze a journal entry with AI
  const analyzeEntryMutation = useMutation({
    mutationFn: (entryId: number) => analyzeJournalEntry(entryId),
    onSuccess: () => {
      // Invalidate the priorities query to refetch
      queryClient.invalidateQueries({ queryKey: ["priorities", formattedDate] });
      // Invalidate the clarifying questions query to refetch
      queryClient.invalidateQueries({ queryKey: ["clarifyingQuestions"] });
    },
    onError: (error) => {
      console.error("Error analyzing journal entry:", error);
      // Don't show an error toast here to avoid overwhelming the user
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
      return;
    }
    
    setIsSubmitting(true);
    
    createEntryMutation.mutate({
      content: newEntry,
      date: formattedDate
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
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };
  
  // Handle loading more entries
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  
  return (
    <div className="space-y-6">
      {/* Floating input bar - always visible */}
      <div className="sticky top-4 z-10 mb-8">
        <form onSubmit={handleSubmit} className="relative">
          <Card className="shadow-lg border-primary/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-2">
                <Textarea
                  ref={textareaRef}
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What's on your mind? (Ctrl+Enter to save)"
                  className="min-h-[60px] resize-none flex-1 focus-visible:ring-primary"
                  disabled={isSubmitting}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="mt-1"
                  disabled={isSubmitting || !newEntry.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
      
      {/* Date selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-primary">Journal Entries</h2>
        <div className="flex items-center gap-2">
          <DatePicker
            date={selectedDate}
            setDate={setSelectedDate}
          />
          <Button variant="outline" size="icon">
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Journal entries */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-destructive">
            <p>Error loading journal entries</p>
            <p className="text-sm">{String(error)}</p>
          </div>
        ) : journalEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No journal entries for this date</p>
            <p className="text-sm">Start writing to create your first entry</p>
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
            
            {/* Infinite scroll loading indicator */}
            <div 
              ref={loadMoreRef} 
              className="flex justify-center py-4"
            >
              {isFetchingNextPage ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : hasNextPage ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground flex items-center gap-1"
                  onClick={handleLoadMore}
                >
                  <ChevronDown className="size-4" />
                  <span>Load more</span>
                </Button>
              ) : journalEntries.length > 0 ? (
                <span className="text-sm text-muted-foreground">No more entries</span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 