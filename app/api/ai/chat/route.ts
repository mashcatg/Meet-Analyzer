import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, meetingData } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build a comprehensive context from meeting data
    let contextParts: string[] = [];

    if (meetingData.participants && Array.isArray(meetingData.participants) && meetingData.participants.length > 0) {
      const participantNames = meetingData.participants.map((p: any) => p.name).join(', ');
      contextParts.push(`Meeting Participants: ${participantNames}`);
    }

    if (meetingData.transcript && Array.isArray(meetingData.transcript) && meetingData.transcript.length > 0) {
      contextParts.push('Recent Transcript Excerpts:');
      meetingData.transcript.slice(0, 10).forEach((item: any) => {
        const text = item.words?.map((w: any) => w.text).join(' ') || item.text;
        if (text) {
          const speaker = item.participant?.name || 'Unknown';
          const excerpt = text.length > 120 ? text.substring(0, 120) + '...' : text;
          contextParts.push(`${speaker}: ${excerpt}`);
        }
      });
    }

    if (meetingData.chat_messages && Array.isArray(meetingData.chat_messages) && meetingData.chat_messages.length > 0) {
      contextParts.push(`Chat Messages (${meetingData.chat_messages.length} total):`);
      meetingData.chat_messages.slice(0, 5).forEach((msg: any) => {
        contextParts.push(`${msg.participant_name}: ${msg.text}`);
      });
    }

    if (meetingData.summary && meetingData.summary.keywords && Array.isArray(meetingData.summary.keywords)) {
      const keywordTexts = meetingData.summary.keywords.map((kw: any) => kw.word || kw).join(', ');
      contextParts.push(`Key Topics Discussed: ${keywordTexts}`);
    }

    const contextString = contextParts.join('\n');

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a helpful meeting assistant. You have access to the following meeting information:\n\n${contextString}\n\nThe user is asking: ${message}\n\nProvide a helpful, natural response. Do not summarize the entire meeting unless asked. Just answer the specific question based on the meeting data available.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API Error:', error);
      return NextResponse.json(
        { error: 'Failed to get response from Gemini' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiResponse =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Unable to generate response';

    return NextResponse.json({
      response: aiResponse,
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
