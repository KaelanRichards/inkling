"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Send, Brain } from "lucide-react";
import { toast } from "sonner";

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
    },
    onError: (error) => {
      console.error("Error answering question:", error);
      toast.error("Failed to submit answer");
    }
  });
  
  // Generate new clarifying questions
  const handleGenerateQuestions = async () => {
    setIsRefreshing(true);
    
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
  const pendingQuestions = questions.filter(q => q.status === "pending");
  const answeredQuestions = questions.filter(q => q.status === "answered");
  
  return (
    <Card className="border-2 border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center justify-between">
          <span>Context Building</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGenerateQuestions}
            disabled={isRefreshing}
            title="Generate new clarifying questions"
            className="text-primary"
          >
            {isRefreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Brain className="size-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-6 text-destructive">
            Error loading questions: {error?.message || "Unknown error"}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="mb-2">No clarifying questions yet</p>
            <p className="text-sm">As you journal, AI will generate questions to deepen understanding</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending questions */}
            {pendingQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Questions to Answer ({pendingQuestions.length})
                </div>
                
                <Accordion type="single" collapsible className="space-y-3">
                  {pendingQuestions.map((question) => (
                    <AccordionItem 
                      key={question.id} 
                      value={`question-${question.id}`}
                      className="border border-muted rounded-md px-4 py-2"
                    >
                      <AccordionTrigger className="text-sm font-medium hover:no-underline py-2">
                        {question.question}
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-1">
                        <div className="space-y-3">
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
                              disabled={!answers[question.id]?.trim() || answerQuestionMutation.isPending}
                              className="flex items-center gap-1"
                            >
                              {answerQuestionMutation.isPending ? (
                                <>
                                  <Loader2 className="size-3 animate-spin" />
                                  <span>Submitting...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="size-3" />
                                  <span>Submit</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
            
            {/* Answered questions */}
            {answeredQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Answered Questions ({answeredQuestions.length})
                </div>
                
                <Accordion type="single" collapsible className="space-y-3">
                  {answeredQuestions.map((question) => (
                    <AccordionItem 
                      key={question.id} 
                      value={`question-${question.id}`}
                      className="border border-muted rounded-md px-4 py-2 bg-muted/30"
                    >
                      <AccordionTrigger className="text-sm font-medium hover:no-underline py-2">
                        {question.question}
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-1">
                        <div className="text-sm text-muted-foreground">
                          {question.answer}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 