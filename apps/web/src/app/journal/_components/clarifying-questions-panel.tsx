"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Send, Brain } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { getClarifyingQuestions, answerClarifyingQuestion, generateClarifyingQuestions } from "@/api/ai.api";

// Define the interface for clarifying questions
interface ClarifyingQuestion {
  id: number;
  question: string;
  status: "pending" | "answered";
  answer?: string;
}

export function ClarifyingQuestionsPanel() {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | undefined>(undefined);
  
  // Fetch clarifying questions
  const { 
    data: questions = [] as ClarifyingQuestion[], 
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["clarifyingQuestions"],
    queryFn: getClarifyingQuestions
  });
  
  // Answer a clarifying question
  const answerQuestionMutation = useMutation({
    mutationFn: ({ id, answer }: { id: number; answer: string }) => 
      answerClarifyingQuestion(id, answer),
    onSuccess: () => {
      // Invalidate the questions query to refetch
      queryClient.invalidateQueries({ queryKey: ["clarifyingQuestions"] });
      toast.success("Answer submitted");
      
      // Close the accordion after submission
      setExpandedQuestion(undefined);
    },
    onError: (error) => {
      console.error("Error answering question:", error);
      toast.error("Failed to submit answer");
    }
  });
  
  // Generate new clarifying questions
  const handleGenerateQuestions = async () => {
    setIsRefreshing(true);
    toast.info("Generating new questions based on your context...");
    
    try {
      await generateClarifyingQuestions();
      await refetch();
      toast.success("New questions generated");
    } catch (error) {
      console.error("Error generating questions:", error);
      toast.error("Failed to generate new questions");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Handle answer input change
  const handleAnswerChange = (id: number, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };
  
  // Handle answer submission
  const handleSubmitAnswer = (id: number) => {
    const answer = answers[id];
    
    if (!answer?.trim()) {
      toast.error("Answer cannot be empty");
      return;
    }
    
    answerQuestionMutation.mutate({ id, answer });
    
    // Clear the answer from state
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[id];
      return newAnswers;
    });
  };
  
  // Filter questions by status
  const pendingQuestions = (questions as ClarifyingQuestion[]).filter((q: ClarifyingQuestion) => q.status === "pending");
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Clarifying Questions</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={handleGenerateQuestions}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="text-center py-4 text-destructive text-sm">
              Error loading questions
            </div>
          ) : pendingQuestions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {isRefreshing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p>Generating questions...</p>
                </div>
              ) : (
                <div>
                  <p>No questions at the moment</p>
                  <p className="text-xs mt-1">Check back later as your context grows</p>
                </div>
              )}
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={expandedQuestion}
              onValueChange={setExpandedQuestion}
              className="space-y-2"
            >
              {pendingQuestions.map((question: ClarifyingQuestion) => (
                <motion.div
                  key={question.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <AccordionItem 
                    value={String(question.id)} 
                    className="border rounded-md px-3 py-1 border-border"
                  >
                    <AccordionTrigger className="hover:no-underline py-2">
                      <span className="text-sm font-medium text-left">
                        {question.question}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2 pb-1 space-y-2">
                        <Textarea
                          placeholder="Type your answer..."
                          value={answers[question.id] || ""}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="min-h-[80px] text-sm"
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleSubmitAnswer(question.id)}
                            disabled={answerQuestionMutation.isPending || !answers[question.id]?.trim()}
                            className="flex items-center gap-1"
                          >
                            {answerQuestionMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            <span>Submit</span>
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
} 