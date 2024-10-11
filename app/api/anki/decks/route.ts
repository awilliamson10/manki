import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const response = await fetch("http://localhost:8765", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error("AnkiConnect request failed")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in AnkiConnect request:", error)
    return NextResponse.json(
      { error: "AnkiConnect request failed" },
      { status: 500 },
    )
  }
}
