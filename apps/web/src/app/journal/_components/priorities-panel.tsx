"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Check, X, ArrowUp, ArrowDown, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { getPrioritiesByDate, createPriority, togglePriorityCompletion, updatePriorityRank, deletePriority } from "@/api/priorities.api";
import { getDailySummary } from "@/api/ai.api";

export function PrioritiesPanel() {
  const queryClient = useQueryClient();
  const [newPriority, setNewPriority] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Get today's date for API requests
  const today = format(new Date(), "yyyy-MM-dd");
  
  // Fetch priorities for today
  const { 
    data: priorities = [], 
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ["priorities", today],
    queryFn: () => getPrioritiesByDate(today)
  });
  
  // Create a new priority
  const createPriorityMutation = useMutation({
    mutationFn: createPriority,
    onSuccess: () => {
      // Invalidate the priorities query to refetch
      queryClient.invalidateQueries({ queryKey: ["priorities", today] });
      
      // Clear the input field
      setNewPriority("");
      
      toast.success("Priority added");
    },
    onError: (error) => {
      console.error("Error creating priority:", error);
      toast.error("Failed to add priority");
    }
  });
  
  // Toggle priority completion status
  const toggleCompletionMutation = useMutation({
    mutationFn: togglePriorityCompletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priorities", today] });
    },
    onError: (error) => {
      console.error("Error toggling priority completion:", error);
      toast.error("Failed to update priority");
    }
  });
  
  // Update priority rank
  const updateRankMutation = useMutation({
    mutationFn: updatePriorityRank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priorities", today] });
    },
    onError: (error) => {
      console.error("Error updating priority rank:", error);
      toast.error("Failed to update priority rank");
    }
  });
  
  // Delete priority
  const deletePriorityMutation = useMutation({
    mutationFn: deletePriority,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priorities", today] });
      toast.success("Priority deleted");
    },
    onError: (error) => {
      console.error("Error deleting priority:", error);
      toast.error("Failed to delete priority");
    }
  });
  
  // Generate priorities from journal entries
  const handleGeneratePriorities = async () => {
    setIsGenerating(true);
    
    try {
      await getDailySummary();
      queryClient.invalidateQueries({ queryKey: ["priorities", today] });
      toast.success("Priorities generated from your journal entries");
    } catch (error) {
      console.error("Error generating priorities:", error);
      toast.error("Failed to generate priorities");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPriority.trim()) {
      toast.error("Priority cannot be empty");
      return;
    }
    
    createPriorityMutation.mutate({
      content: newPriority,
      date: new Date(today),
      completed: false
    });
  };
  
  // Handle priority completion toggle
  const handleToggleCompletion = (id: number, completed: boolean) => {
    toggleCompletionMutation.mutate({ id });
  };
  
  // Handle priority rank change
  const handleRankChange = (id: number, direction: "up" | "down") => {
    const newRank = direction === "up" ? -1 : 1; // Adjust rank based on direction
    updateRankMutation.mutate({ id, rank: newRank });
  };
  
  // Handle priority deletion
  const handleDelete = (id: number) => {
    deletePriorityMutation.mutate({ id });
  };
  
  // Filter priorities by completion status
  const completedPriorities = priorities.filter(p => p.completed);
  const pendingPriorities = priorities.filter(p => !p.completed);
  
  return (
    <Card className="border-2 border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center justify-between">
          <span>Daily Priorities</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGeneratePriorities}
            disabled={isGenerating}
            title="Generate priorities from journal entries"
            className="text-primary"
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* New priority form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Add a new priority..."
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={createPriorityMutation.isPending || !newPriority.trim()}
          >
            {createPriorityMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
        </form>
        
        {/* Priorities list */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-6 text-destructive">
            Error loading priorities: {error?.message || "Unknown error"}
          </div>
        ) : priorities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="mb-2">No priorities for today</p>
            <p className="text-sm">Add priorities manually or generate them from your journal entries</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending priorities */}
            {pendingPriorities.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  In Progress ({pendingPriorities.length})
                </div>
                <ul className="space-y-2">
                  {pendingPriorities.map((priority) => (
                    <li key={priority.id} className="flex items-start gap-2 group">
                      <Checkbox
                        checked={priority.completed}
                        onCheckedChange={() => handleToggleCompletion(priority.id, priority.completed)}
                        className="mt-1"
                      />
                      <div className="flex-1 text-sm">{priority.content}</div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => handleRankChange(priority.id, "up")}
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => handleRankChange(priority.id, "down")}
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive"
                          onClick={() => handleDelete(priority.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Completed priorities */}
            {completedPriorities.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground flex items-center">
                  <span>Completed ({completedPriorities.length})</span>
                </div>
                <ul className="space-y-2">
                  {completedPriorities.map((priority) => (
                    <li key={priority.id} className="flex items-start gap-2 group text-muted-foreground">
                      <Checkbox
                        checked={priority.completed}
                        onCheckedChange={() => handleToggleCompletion(priority.id, priority.completed)}
                        className="mt-1"
                      />
                      <div className="flex-1 text-sm line-through">{priority.content}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => handleDelete(priority.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 