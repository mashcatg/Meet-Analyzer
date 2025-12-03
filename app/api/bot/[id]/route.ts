import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let botId = '';
  
  try {
    const resolvedParams = await params;
    botId = resolvedParams.id;
    
    const RECALL_API_KEY = process.env.RECALL_API_KEY;
    const RECALL_REGION = process.env.RECALL_REGION || 'us-west-2';

    console.log('📊 Fetching complete bot data...');
    console.log('   Bot ID:', botId);

    const botUrl = `https://${RECALL_REGION}.recall.ai/api/v1/bot/${botId}`;
    
    const botResponse = await axios.get(botUrl, {
      headers: {
        'Authorization': RECALL_API_KEY!,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const botData = botResponse.data;
    const statusChanges = botData.status_changes || [];
    const latestStatus = statusChanges[statusChanges.length - 1];
    const currentStatus = latestStatus?.code || 'unknown';
    const isComplete = currentStatus === 'done';

    console.log('✅ Bot retrieved - Status:', currentStatus);

    // Initialize all data structures
    let mediaUrls = {
      video_mixed_url: null as string | null,
      audio_mixed_url: null as string | null,
      video_separate_urls: [] as any[],
      audio_separate_urls: [] as any[]
    };

    let transcript: any[] = [];
    let participantEvents: any[] = [];
    let participants: any[] = [];
    let meetingMetadata: any = {};
    let chatMessages: any[] = [];

    if (botData.recordings && botData.recordings.length > 0) {
      const recording = botData.recordings[0];
      const recordingId = recording.id;
      const recordingStatus = recording.status?.code;
      const isRecordingComplete = recordingStatus === 'done';

      console.log('   Recording ID:', recordingId);
      console.log('   Recording complete:', isRecordingComplete);

      if (isRecordingComplete && recording.media_shortcuts) {
        // ==========================================
        // 1. VIDEO MIXED
        // ==========================================
        if (recording.media_shortcuts.video_mixed?.data?.download_url) {
          mediaUrls.video_mixed_url = recording.media_shortcuts.video_mixed.data.download_url;
          console.log('   ✅ Video Mixed available');
        }

        // ==========================================
        // 2. MEETING METADATA
        // ==========================================
        if (recording.media_shortcuts.meeting_metadata?.data) {
          meetingMetadata = recording.media_shortcuts.meeting_metadata.data;
          console.log('   ✅ Meeting Metadata:', JSON.stringify(meetingMetadata));
        }

        // ==========================================
        // 3. FETCH TRANSCRIPT DATA (DOWNLOAD IT!)
        // ==========================================
        if (recording.media_shortcuts.transcript?.data?.download_url) {
          const transcriptUrl = recording.media_shortcuts.transcript.data.download_url;
          console.log('   📝 Downloading transcript...');
          
          try {
            const transcriptResponse = await axios.get(transcriptUrl, { timeout: 30000 });
            transcript = Array.isArray(transcriptResponse.data) ? transcriptResponse.data : [];
            console.log('   ✅ Transcript downloaded:', transcript.length, 'utterances');
          } catch (e: any) {
            console.log('   ⚠️ Transcript download failed:', e.message);
          }
        } else {
          console.log('   ⚠️ No transcript available - was it enabled when creating the bot?');
        }

        // ==========================================
        // 4. FETCH PARTICIPANT EVENTS (DOWNLOAD IT!)
        // ==========================================
        if (recording.media_shortcuts.participant_events?.data?.participant_events_download_url) {
          const participantEventsUrl = recording.media_shortcuts.participant_events.data.participant_events_download_url;
          console.log('   👥 Downloading participant events...');
          
          try {
            const participantEventsResponse = await axios.get(participantEventsUrl, { 
              timeout: 30000 
            });
            
            if (Array.isArray(participantEventsResponse.data)) {
              participantEvents = participantEventsResponse.data;
              console.log('   ✅ Participant events downloaded:', participantEvents.length, 'events');
              
              // Extract chat messages - they have 'data' property with 'text' and 'to'
              chatMessages = participantEvents
                .filter((event: any) => {
                  return event.data && 
                         typeof event.data.text === 'string' && 
                         event.data.to;
                })
                .map((event: any) => ({
                  participant_name: event.participant?.name || 'Unknown',
                  participant_id: event.participant?.id,
                  text: event.data.text,
                  to: event.data.to,
                  timestamp_absolute: event.timestamp?.absolute,
                  timestamp_relative_seconds: event.timestamp?.relative
                }));
              
              console.log('   ✅ Chat messages extracted:', chatMessages.length);
            }
          } catch (e: any) {
            console.log('   ⚠️ Participant events download failed:', e.message);
          }
        }

        // ==========================================
        // 5. FETCH PARTICIPANTS LIST (DOWNLOAD IT!)
        // ==========================================
        if (recording.media_shortcuts.participant_events?.data?.participants_download_url) {
          const participantsUrl = recording.media_shortcuts.participant_events.data.participants_download_url;
          console.log('   👥 Downloading participants list...');
          
          try {
            const participantsResponse = await axios.get(participantsUrl, { 
              timeout: 30000 
            });
            
            if (Array.isArray(participantsResponse.data)) {
              participants = participantsResponse.data;
              console.log('   ✅ Participants list downloaded:', participants.length, 'participants');
            }
          } catch (e: any) {
            console.log('   ⚠️ Participants download failed:', e.message);
          }
        }

        // ==========================================
        // 6. AUDIO MIXED (dedicated endpoint)
        // ==========================================
        try {
          const audioMixedUrl = `https://${RECALL_REGION}.recall.ai/api/v1/audio_mixed/?recording_id=${recordingId}`;
          const audioMixedResponse = await axios.get(audioMixedUrl, {
            headers: {
              'Authorization': RECALL_API_KEY!,
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          if (audioMixedResponse.data?.results && audioMixedResponse.data.results.length > 0) {
            const audioMixed = audioMixedResponse.data.results[0];
            if (audioMixed?.data?.download_url) {
              mediaUrls.audio_mixed_url = audioMixed.data.download_url;
              console.log('   ✅ Audio Mixed available');
            }
          }
        } catch (e: any) {
          console.log('   ⚠️ Audio Mixed not available:', e.message);
        }

        // ==========================================
        // 7. AUDIO SEPARATE (dedicated endpoint)
        // ==========================================
        try {
          const audioSeparateUrl = `https://${RECALL_REGION}.recall.ai/api/v1/audio_separate/?recording_id=${recordingId}`;
          const audioSeparateResponse = await axios.get(audioSeparateUrl, {
            headers: {
              'Authorization': RECALL_API_KEY!,
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          if (audioSeparateResponse.data?.results && Array.isArray(audioSeparateResponse.data.results)) {
            audioSeparateResponse.data.results.forEach((track: any) => {
              if (track?.data?.download_url) {
                mediaUrls.audio_separate_urls.push({
                  url: track.data.download_url,
                  participant_id: track.metadata?.participant_id,
                  participant_name: track.metadata?.participant_name || 'Unknown',
                  format: track.data?.format || 'unknown',
                  created_at: track.created_at
                });
              }
            });
            console.log('   ✅ Audio Separate:', mediaUrls.audio_separate_urls.length, 'tracks');
          }
        } catch (e: any) {
          console.log('   ⚠️ Audio Separate not available:', e.message);
        }

        // ==========================================
        // 8. VIDEO SEPARATE (dedicated endpoint)
        // ==========================================
        try {
          const videoSeparateUrl = `https://${RECALL_REGION}.recall.ai/api/v1/video_separate/?recording_id=${recordingId}`;
          const videoSeparateResponse = await axios.get(videoSeparateUrl, {
            headers: {
              'Authorization': RECALL_API_KEY!,
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          if (videoSeparateResponse.data?.results && Array.isArray(videoSeparateResponse.data.results)) {
            videoSeparateResponse.data.results.forEach((track: any) => {
              if (track?.data?.download_url) {
                mediaUrls.video_separate_urls.push({
                  url: track.data.download_url,
                  participant_id: track.metadata?.participant_id,
                  participant_name: track.metadata?.participant_name || 'Unknown',
                  format: track.data?.format || 'unknown',
                  created_at: track.created_at
                });
              }
            });
            console.log('   ✅ Video Separate:', mediaUrls.video_separate_urls.length, 'tracks');
          }
        } catch (e: any) {
          console.log('   ⚠️ Video Separate not available:', e.message);
        }

      } else if (!isRecordingComplete) {
        console.log('   ⏳ Recording still processing');
      }
    }

    // ==========================================
    // 9. EXTRACT PARTICIPANT STATS FROM TRANSCRIPT
    // ==========================================
    const participantStats = extractParticipantStats(transcript);

    // ==========================================
    // 10. CALCULATE MEETING DURATION
    // ==========================================
    const duration = calculateDuration(statusChanges);

    // ==========================================
    // 11. GENERATE SUMMARY
    // ==========================================
    const summary = generateSummary(transcript, participantStats, chatMessages);

    // ==========================================
    // COMPILE COMPLETE RESULT
    // ==========================================
    const result = {
      bot_id: botData.id,
      status: currentStatus,
      is_complete: isComplete,
      
      meeting_metadata: meetingMetadata,
      meeting_url: botData.meeting_url || null,
      
      duration: {
        milliseconds: duration,
        formatted: formatDuration(duration)
      },
      
      participants: participants.length > 0 ? participants : participantStats,
      participant_count: participants.length > 0 ? participants.length : participantStats.length,
      participant_stats: participantStats,
      
      transcript: transcript,
      transcript_utterance_count: transcript.length,
      transcript_word_count: transcript.reduce((sum, item) => sum + (item.words?.length || 0), 0),
      
      chat_messages: chatMessages,
      chat_message_count: chatMessages.length,
      
      summary: summary,
      
      media: {
        video_mixed: mediaUrls.video_mixed_url,
        audio_mixed: mediaUrls.audio_mixed_url,
        video_separate: mediaUrls.video_separate_urls,
        audio_separate: mediaUrls.audio_separate_urls,
        video_separate_count: mediaUrls.video_separate_urls.length,
        audio_separate_count: mediaUrls.audio_separate_urls.length
      },
      
      participant_events: participantEvents,
      participant_events_count: participantEvents.length,
      status_changes: statusChanges,
      
      created_at: botData.created_at,
      recording_id: botData.recordings?.[0]?.id || null
    };

    console.log('\n📊 COMPLETE DATA SUMMARY:');
    console.log('   Status:', result.status);
    console.log('   Duration:', result.duration.formatted);
    console.log('   Participants:', result.participant_count);
    console.log('   Transcript utterances:', result.transcript_utterance_count);
    console.log('   Chat messages:', result.chat_message_count);
    console.log('   Video Mixed:', !!result.media.video_mixed);
    console.log('   Audio Mixed:', !!result.media.audio_mixed);
    console.log('   Video Separate:', result.media.video_separate_count);
    console.log('   Audio Separate:', result.media.audio_separate_count);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return NextResponse.json(
      {
        error: 'Failed to fetch bot data',
        details: error.message,
        bot_id: botId
      },
      { status: 500 }
    );
  }
}

// ==========================================
// FIXED: Extract participant stats from transcript
// ==========================================
function extractParticipantStats(transcript: any[]) {
  const participantsMap = new Map();
  
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return [];
  }
  
  transcript.forEach((item: any) => {
    const speaker = item.participant?.name || item.speaker || 'Unknown';
    
    if (!participantsMap.has(speaker)) {
      participantsMap.set(speaker, {
        name: speaker,
        speaking_time_seconds: 0,
        word_count: 0,
        utterances: 0
      });
    }
    
    const participant = participantsMap.get(speaker);
    
    // Calculate speaking time from word timestamps
    if (item.words && Array.isArray(item.words) && item.words.length > 0) {
      const firstWord = item.words[0];
      const lastWord = item.words[item.words.length - 1];
      
      // Timestamps have 'relative' property in seconds
      const startTime = firstWord?.start_timestamp?.relative;
      const endTime = lastWord?.end_timestamp?.relative;
      
      if (typeof startTime === 'number' && 
          typeof endTime === 'number' && 
          !isNaN(startTime) && 
          !isNaN(endTime)) {
        const duration = endTime - startTime;
        if (duration >= 0 && !isNaN(duration)) {
          participant.speaking_time_seconds += duration;
        }
      }
      
      participant.word_count += item.words.length;
    }
    
    participant.utterances += 1;
  });
  
  return Array.from(participantsMap.values()).map(p => ({
    name: p.name,
    speaking_time_seconds: p.speaking_time_seconds,
    speaking_time_formatted: formatDuration(p.speaking_time_seconds * 1000),
    word_count: p.word_count,
    utterances: p.utterances
  }));
}

function calculateDuration(statusChanges: any[]): number {
  if (!Array.isArray(statusChanges) || statusChanges.length === 0) {
    return 0;
  }
  
  // Find when bot joined the call
  const joinedEvent = statusChanges.find(
    (s: any) => s.code === 'in_call_not_recording' || s.code === 'in_call_recording'
  );
  
  // Find when bot left/completed
  const leftEvent = statusChanges.find((s: any) => s.code === 'done' || s.code === 'fatal');
  
  if (!joinedEvent || !leftEvent) {
    console.log('⚠️ Missing status events for duration calculation');
    console.log('   Joined event:', !!joinedEvent);
    console.log('   Left event:', !!leftEvent);
    return 0;
  }
  
  try {
    const start = new Date(joinedEvent.created_at).getTime();
    const end = new Date(leftEvent.created_at).getTime();
    
    if (isNaN(start) || isNaN(end)) {
      console.log('⚠️ Invalid timestamps in status changes');
      return 0;
    }
    
    return end - start;
  } catch (e) {
    console.log('⚠️ Error calculating duration:', e);
    return 0;
  }
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0 || isNaN(ms)) {
    return '0m 0s';
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

function generateSummary(transcript: any[], participants: any[], chatMessages: any[]) {
  if (!transcript || transcript.length === 0) {
    return {
      available: false,
      message: 'No transcript available for summary generation'
    };
  }

  const wordFrequency = new Map<string, number>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'um', 'uh', 'yeah', 'yes', 'no', 'okay', 'ok']);

  transcript.forEach(item => {
    if (item.words && Array.isArray(item.words)) {
      item.words.forEach((word: any) => {
        const text = word.text?.toLowerCase().replace(/[^\w\s]/g, '');
        if (text && text.length > 3 && !stopWords.has(text)) {
          wordFrequency.set(text, (wordFrequency.get(text) || 0) + 1);
        }
      });
    }
  });

  const keywords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const totalWords = transcript.reduce((sum, item) => sum + (item.words?.length || 0), 0);
  const avgWordsPerUtterance = transcript.length > 0 ? Math.round(totalWords / transcript.length) : 0;

  const speakerActivity = participants
    .sort((a, b) => b.word_count - a.word_count)
    .slice(0, 5)
    .map(p => ({
      name: p.name,
      word_count: p.word_count,
      speaking_time: p.speaking_time_formatted,
      utterances: p.utterances
    }));

  return {
    available: true,
    overview: {
      total_utterances: transcript.length,
      total_words: totalWords,
      avg_words_per_utterance: avgWordsPerUtterance,
      total_participants: participants.length,
      total_chat_messages: chatMessages.length
    },
    keywords,
    most_active_speakers: speakerActivity,
    chat_activity: {
      total_messages: chatMessages.length,
      participants_who_chatted: [...new Set(chatMessages.map(m => m.participant_name))].length
    }
  };
}
