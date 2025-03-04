"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Check, X, ArrowUp, ArrowDown, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
  const [isAddingPriority, setIsAddingPriority] = useState(false);
  
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
      setIsAddingPriority(false);
      
      toast.success("Priority added");
    },
    onError: (error) => {
      console.error("Error creating priority:", error);
      toast.error("Failed to add priority");
      setIsAddingPriority(false);
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
    toast.info("Analyzing your journal entries...");
    
    try {
      await getDailySummary();
      queryClient.invalidateQueries({ queryKey: ["priorities", today] });
      toast.success("Priorities generated");
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
      return;
    }
    
    createPriorityMutation.mutate({
      content: newPriority,
      date: new Date(today),
      rank: priorities.length + 1
    });
  };
  
  // Sort priorities by rank
  const sortedPriorities = [...priorities].sort((a, b) => a.rank - b.rank);
  
  // Count completed priorities
  const completedCount = priorities.filter(p => p.completed).length;
  const totalCount = priorities.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Today's Priorities</CardTitle>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setIsAddingPriority(true)}
              disabled={isAddingPriority}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleGeneratePriorities}
              disabled={isGenerating}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-2">
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground text-right">
              {completedCount}/{totalCount} completed
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pb-3">
        <AnimatePresence mode="popLayout">
          {/* Add new priority form */}
          {isAddingPriority && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="mb-3"
            >
              <div className="flex gap-2">
                <Input
                  placeholder="Add a new priority..."
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={createPriorityMutation.isPending || !newPriority.trim()}
                >
                  {createPriorityMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsAddingPriority(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.form>
          )}
          
          {/* Loading state */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="text-center py-4 text-destructive text-sm">
              Error loading priorities
            </div>
          ) : sortedPriorities.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p>Generating priorities...</p>
                </div>
              ) : (
                <div>
                  <p>No priorities for today</p>
                  <p className="text-xs mt-1">Add manually or generate from your journal</p>
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedPriorities.map((priority) => (
                <motion.li 
                  key={priority.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-2 p-2 rounded-md ${
                    priority.completed ? "bg-secondary/30" : "bg-card"
                  }`}
                >
                  <Checkbox 
                    checked={priority.completed}
                    onCheckedChange={() => toggleCompletionMutation.mutate({ id: priority.id })}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${priority.completed ? "line-through text-muted-foreground" : ""}`}>
                      {priority.content}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => updateRankMutation.mutate({ id: priority.id, rank: priority.rank - 1 })}
                      disabled={priority.rank <= 1}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => updateRankMutation.mutate({ id: priority.id, rank: priority.rank + 1 })}
                      disabled={priority.rank >= sortedPriorities.length}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deletePriorityMutation.mutate({ id: priority.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
} 