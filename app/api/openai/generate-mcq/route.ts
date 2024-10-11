import { NextResponse } from "next/server"
import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import { z } from "zod"

// Define the Zod schema for the MCQ response
const MCQResponse = z.object({
  title: z.string(),
  question: z.string(),
  options: z.array(
    z.object({
      text: z.string(),
      explanation: z.string(),
    }),
  ),
  correctAnswerIndex: z.number().int(),
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  const { question, answer } = await request.json()

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates multiple-choice questions based on Anki cards. Ensure there is only one correct answer.",
        },
        {
          role: "user",
          content: `Generate a multiple-choice question based on this Anki card:
            Question: ${question}
            Answer: ${answer}
            
            Provide the following:
            1. A short title description of the card (max 10 words)
            2. The question
            3. 4 options (including the correct answer)
            4. The index of the correct answer (0-3)
            5. An explanation for each option (why it's correct or incorrect)

            Ensure there is only one correct answer.`,
        },
      ],
      response_format: zodResponseFormat(MCQResponse, "mcq_response"),
    })

    const message = completion.choices[0]?.message
    if (message?.parsed) {
      return NextResponse.json(message.parsed)
    } else {
      throw new Error("Failed to parse OpenAI response")
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error)
    return NextResponse.json(
      { error: "Failed to generate MCQ" },
      { status: 500 },
    )
  }
}
