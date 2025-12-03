import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const { meeting_url } = await request.json();
    
    if (!meeting_url) {
      return NextResponse.json(
        { error: 'meeting_url is required' },
        { status: 400 }
      );
    }

    const RECALL_API_KEY = process.env.RECALL_API_KEY;
    const RECALL_REGION = process.env.RECALL_REGION || 'us-west-2';

    console.log('🤖 Creating bot for meeting:', meeting_url);
    console.log('🌍 Region:', RECALL_REGION);

    const botPayload = {
      meeting_url: meeting_url,
      bot_name: 'Meeting Assistant',
      recording_config: {
        // ✅ Recall.ai's native transcription (no external providers needed)
        transcript: {
          provider: {
            recallai_streaming: {
              language_code: 'auto',
              filter_profanity: false,
              mode: 'prioritize_accuracy'
            }
          }
        },
        
        // Enable participant events for speaker timeline & chat
        participant_events: {},
        
        // Enable all media types
        video_mixed_mp4: {},
        audio_mixed_mp3: {},
        audio_separate_wav: {},
        video_separate_mp4: {},
        
        // Enable meeting metadata
        meeting_metadata: {}
      }
    };

    const response = await axios.post(
      `https://${RECALL_REGION}.recall.ai/api/v1/bot/`,
      botPayload,
      {
        headers: {
          'Authorization': RECALL_API_KEY!,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Bot created successfully!');
    console.log('   Bot ID:', response.data.id);
    console.log('   Status:', response.data.status_changes?.[0]?.code || 'created');

    return NextResponse.json({
      success: true,
      bot_id: response.data.id,
      status: response.data.status_changes?.[0]?.code || 'created',
      full_response: response.data
    });

  } catch (error: any) {
    console.error('❌ Error creating bot:');
    console.error('   Status:', error.response?.status);
    console.error('   Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('   Message:', error.message);
    
    return NextResponse.json(
      {
        error: 'Failed to create bot',
        details: error.response?.data || error.message,
        status: error.response?.status
      },
      { status: 500 }
    );
  }
}
