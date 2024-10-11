"use client"
import { useEffect, useState } from "react"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import slugify from "slugify"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface DeckNode {
  name: string
  id: string
  children: DeckNode[]
  new: number
  learn: number
  due: number
  isExpanded: boolean
  isLoading: boolean
  fullName: string
}

export default function Dashboard() {
  const router = useRouter()
  const [deckTree, setDeckTree] = useState<DeckNode[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDecks()
  }, [])

  async function fetchDecks() {
    try {
      const response = await fetch("/api/anki/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deckNamesAndIds", version: 6 }),
      })

      if (!response.ok) throw new Error("Failed to fetch decks")

      const data = await response.json()
      const tree = buildDeckTree(data.result)
      await fetchTopLevelDeckStats(tree)
      setDeckTree(tree)
    } catch (error) {
      console.error("Error fetching decks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function buildDeckTree(decks: { [key: string]: number }): DeckNode[] {
    const root: DeckNode[] = []
    const deckMap: { [key: string]: DeckNode } = {}

    Object.entries(decks).forEach(([fullName, id]) => {
      const parts = fullName.split("::")
      let currentLevel = root
      let currentPath = ""

      parts.forEach((part, index) => {
        currentPath += (index > 0 ? "::" : "") + part
        if (!deckMap[currentPath]) {
          const newNode: DeckNode = {
            name: part,
            id: id.toString(),
            children: [],
            new: 0,
            learn: 0,
            due: 0,
            isExpanded: false,
            isLoading: false,
            fullName: currentPath,
          }
          deckMap[currentPath] = newNode
          if (index === parts.length - 1) {
            currentLevel.push(newNode)
          } else {
            const parentPath = parts.slice(0, index).join("::")
            const parent = deckMap[parentPath]
            if (parent) {
              parent.children.push(newNode)
            } else {
              currentLevel.push(newNode)
            }
          }
        }
        currentLevel = deckMap[currentPath].children
      })
    })

    return root
  }

  async function fetchTopLevelDeckStats(decks: DeckNode[]) {
    const topLevelDeckNames = decks.map((deck) => deck.fullName)
    await fetchDeckStats(topLevelDeckNames)
  }

  async function fetchDeckStats(deckNames: string[]) {
    try {
      const response = await fetch("/api/anki/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getDeckStats",
          version: 6,
          params: { decks: deckNames },
        }),
      })

      if (!response.ok) throw new Error("Failed to fetch deck stats")

      const data = await response.json()
      updateDeckStats(deckTree, data.result)
      setDeckTree([...deckTree])
    } catch (error) {
      console.error("Error fetching deck stats:", error)
    }
  }

  function updateDeckStats(decks: DeckNode[], stats: any) {
    decks.forEach((deck) => {
      const deckStats = stats[deck.id]
      if (deckStats) {
        deck.new = deckStats.new_count
        deck.learn = deckStats.learn_count
        deck.due = deckStats.review_count
      }
      updateDeckStats(deck.children, stats)
    })
  }

  async function toggleExpand(deck: DeckNode) {
    deck.isExpanded = !deck.isExpanded
    if (deck.isExpanded && deck.children.length > 0 && !deck.children[0].new) {
      deck.isLoading = true
      setDeckTree([...deckTree])
      await fetchDeckStats(deck.children.map((child) => child.fullName))
      deck.isLoading = false
    }
    setDeckTree([...deckTree])
  }

  function renderDeckTree(decks: DeckNode[], level: number = 0) {
    return decks.map((deck) => (
      <div key={deck.id} className={`py-2 ${level > 0 ? "ml-6" : ""}`}>
        <div className="flex items-center space-x-2">
          {deck.children.length > 0 && (
            <button
              onClick={() => toggleExpand(deck)}
              className="text-gray-500 hover:text-gray-700"
            >
              {deck.isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}
          {deck.children.length === 0 && <span className="w-4"></span>}
          <span
            className="flex-grow cursor-pointer"
            onClick={() =>
              router.push(
                `/decks/${slugify(deck.fullName.replaceAll("::", "_"), {
                  replacement: "-",
                })}`,
              )
            }
          >
            {deck.name}
          </span>
          {deck.isLoading ? (
            <Skeleton className="w-24 h-6" />
          ) : (
            <div className="flex space-x-4 text-sm">
              <span className="text-blue-500 w-8 text-right">{deck.new}</span>
              <span className="text-red-500 w-8 text-right">{deck.learn}</span>
              <span className="text-green-500 w-8 text-right">{deck.due}</span>
            </div>
          )}
        </div>
        {deck.isExpanded &&
          deck.children.length > 0 &&
          renderDeckTree(deck.children, level + 1)}
      </div>
    ))
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Decks</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>Deck</span>
              <div className="space-x-4">
                <span className="text-blue-500">New</span>
                <span className="text-red-500">Learn</span>
                <span className="text-green-500">Due</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full h-[200px]" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Decks</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between">
            <span>Deck</span>
            <div className="space-x-4 text-sm">
              <span className="text-blue-500 w-8 inline-block text-right">
                New
              </span>
              <span className="text-red-500 w-8 inline-block text-right">
                Learn
              </span>
              <span className="text-green-500 w-8 inline-block text-right">
                Due
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>{renderDeckTree(deckTree)}</CardContent>
      </Card>
    </div>
  )
}
