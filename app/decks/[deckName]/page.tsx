"use client"
import { useState, useEffect } from "react"

import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"

interface AnkiCard {
  id: number
  question: string
  answer: string
}

interface MCQOption {
  text: string
  explanation: string
}

interface MultipleChoiceQuestion {
  title: string
  question: string
  options: MCQOption[]
  correctAnswerIndex: number
}

function stripHTML(html: string): string {
  const tmp = document.createElement("DIV")
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ""
}

function extractClozeContent(html: string): {
  question: string
  answer: string
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // Remove style tag
  const styleTag = doc.querySelector("style")
  if (styleTag) styleTag.remove()

  // Extract question
  let question = doc.body.innerHTML
  question = question.replace(
    /<span class="cloze"[^>]*>\[...\]<\/span>/g,
    "_____",
  )

  // Extract answer
  const clozeElement = doc.querySelector(".cloze")
  const answer = clozeElement
    ? clozeElement.getAttribute("data-cloze") || ""
    : ""

  return { question: stripHTML(question), answer: stripHTML(answer) }
}
export default function DeckPage() {
  const { deckName } = useParams()
  const [cardIds, setCardIds] = useState<number[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [currentCard, setCurrentCard] = useState<AnkiCard | null>(null)
  const [mcq, setMcq] = useState<MultipleChoiceQuestion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showExplanation, setShowExplanation] = useState(false)
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(
    null,
  )

  useEffect(() => {
    if (deckName) {
      fetchDueCards(deckName as string)
    }
  }, [deckName])

  useEffect(() => {
    if (cardIds.length > 0 && currentCardIndex < cardIds.length) {
      fetchCardInfo(cardIds[currentCardIndex])
    }
  }, [cardIds, currentCardIndex])

  async function fetchDueCards(deckName: string) {
    setIsLoading(true)
    try {
      const response = await fetch("/api/anki/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "findCards",
          version: 6,
          params: {
            query: `deck:"${deckName}" (is:due or is:new or is:review)`,
          },
        }),
      })

      if (!response.ok) throw new Error("Failed to fetch cards")

      const data = await response.json()
      setCardIds(data.result)
    } catch (error) {
      console.error("Error fetching due cards:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchCardInfo(cardId: number) {
    setIsLoading(true)
    try {
      const response = await fetch("/api/anki/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cardsInfo",
          version: 6,
          params: {
            cards: [cardId],
          },
        }),
      })

      if (!response.ok) throw new Error("Failed to fetch card info")

      const data = await response.json()
      const cardInfo = data.result[0]
      const { question, answer } = extractClozeContent(cardInfo.question)

      const card: AnkiCard = {
        id: cardInfo.cardId,
        question,
        answer,
      }

      setCurrentCard(card)
      await getCachedOrGenerateMCQ(card)
    } catch (error) {
      console.error("Error fetching card info:", error)
      setIsLoading(false)
    }
  }

  async function getCachedOrGenerateMCQ(card: AnkiCard) {
    const cacheKey = `mcq_${card.id}`
    const cachedMCQ = localStorage.getItem(cacheKey)

    if (cachedMCQ) {
      setMcq(JSON.parse(cachedMCQ))
      setIsLoading(false)
    } else {
      await generateMCQ(card)
    }
  }

  async function generateMCQ(card: AnkiCard) {
    setShowExplanation(false)
    setSelectedAnswerIndex(null)
    try {
      const response = await fetch("/api/openai/generate-mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: card.question,
          answer: card.answer,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate MCQ")

      const data: MultipleChoiceQuestion = await response.json()
      setMcq(data)

      // Cache the generated MCQ
      localStorage.setItem(`mcq_${card.id}`, JSON.stringify(data))
    } catch (error) {
      console.error("Error generating MCQ:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleAnswerSelection(index: number) {
    setSelectedAnswerIndex(index)
    setShowExplanation(true)
  }

  function nextCard() {
    if (currentCardIndex < cardIds.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
      setShowExplanation(false)
      setSelectedAnswerIndex(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Loading...</h1>
        <Card>
          <CardContent>
            <Skeleton className="w-full h-[200px]" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (cardIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{deckName}</h1>
        <Card>
          <CardContent>
            <p>No due cards found in this deck.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{deckName}</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            Card {currentCardIndex + 1} of {cardIds.length}
          </CardTitle>
          {mcq && <p className="text-sm text-gray-500">{mcq.title}</p>}
        </CardHeader>
        <CardContent>
          {mcq && (
            <div className="space-y-4">
              <p className="font-semibold">{mcq.question}</p>
              <RadioGroup
                onValueChange={(value) =>
                  handleAnswerSelection(parseInt(value))
                }
              >
                {mcq.options.map((option, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={index.toString()}
                        id={`option-${index}`}
                        disabled={showExplanation}
                      />
                      <Label htmlFor={`option-${index}`}>{option.text}</Label>
                    </div>
                    {showExplanation && (
                      <p
                        className={`text-sm p-2 rounded-md ${
                          index === mcq.correctAnswerIndex
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {option.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
        </CardContent>
      </Card>
      <Button
        onClick={nextCard}
        disabled={currentCardIndex === cardIds.length - 1 || !showExplanation}
      >
        Next Card
      </Button>
    </div>
  )
}
