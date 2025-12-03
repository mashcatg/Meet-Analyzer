'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Zap, Loader2, MessageCircle } from 'lucide-react';

interface MeetingData {
  bot_id: string;
  status: string;
  meeting_metadata: any;
  meeting_url: any;
  duration: { milliseconds: number; formatted: string };
  participants: Array<{
    name: string;
    speaking_time_seconds: number;
    speaking_time_formatted: string;
    word_count: number;
    utterances: number;
  }>;
  participant_count: number;
  participant_stats: any[];
  transcript: any[];
  transcript_utterance_count: number;
  transcript_word_count: number;
  chat_messages: any[];
  chat_message_count: number;
  summary: any;
  media: {
    video_mixed: string | null;
    audio_mixed: string | null;
    video_separate: any[];
    audio_separate: any[];
    video_separate_count: number;
    audio_separate_count: number;
  };
  participant_events: any[];
  participant_events_count: number;
  status_changes: any[];
  recording_id: string | null;
  created_at: string;
}

export default function Home() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [botId, setBotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-refresh when bot is not done yet
  useEffect(() => {
    if (!botId || !autoRefresh) return;

    const interval = setInterval(async () => {
      console.log('Auto-refreshing bot status...');
      await fetchMeetingData(true);
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [botId, autoRefresh]);

  // Stop auto-refresh when bot is done
  useEffect(() => {
    if (meetingData?.status === 'done') {
      console.log('Bot is done! Stopping auto-refresh.');
      setAutoRefresh(false);
    }
  }, [meetingData?.status]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

  const createBot = async () => {
    if (!meetingUrl) {
      setError('Please enter a meeting URL');
      return;
    }

    setLoading(true);
    setError('');
    setMeetingData(null);
    
    try {
      console.log('Creating bot...');
      const response = await fetch('/api/bot/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_url: meetingUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create bot');
      }

      console.log('Bot created:', data.bot_id);
      setBotId(data.bot_id);
      setError('');
      setAutoRefresh(true);
      setTimeout(() => fetchMeetingData(true), 2000);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingData = async (silent = false) => {
    if (!botId) return;

    if (!silent) setLoading(true);
    setError('');

    try {
      console.log('Fetching meeting data...');
      const response = await fetch(`/api/bot/${botId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch meeting data');
      }

      console.log('Data retrieved, status:', data.status);
      setMeetingData(data);
      setError('');
      
      if (data.status !== 'done' && !autoRefresh) {
        setAutoRefresh(true);
      }
    } catch (err: any) {
      console.error('Error:', err);
        if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 1000 / 60);
    const seconds = Math.floor((ms / 1000) % 60);
    return `${minutes}m ${seconds}s`;
  };

  const formatSpeakingTime = (seconds: number) => {
    const mins = Math.floor(seconds);
    const secs = Math.floor((seconds % 1) * 60);
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'in_call_recording': return 'bg-red-500';
      case 'in_call_not_recording': return 'bg-blue-500';
      case 'call_ended': return 'bg-yellow-500';
      case 'fatal': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'joining_call': return 'Bot is joining the meeting...';
      case 'in_waiting_room': return 'Bot is in the waiting room...';
      case 'in_call_not_recording': return 'Bot is in call (not recording yet)...';
      case 'in_call_recording': return 'Bot is recording! Speak now.';
      case 'call_ended': return 'Meeting ended. Processing transcript and media...';
      case 'done': return 'Recording complete! All data is ready.';
      case 'fatal': return 'Bot encountered an error.';
      default: return `Status: ${status}`;
    }
  };

  const sendAIMessage = async () => {
    if (!aiInput.trim() || !meetingData || aiLoading) return;

    const userMessage = { role: 'user', content: aiInput };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setAiLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiInput,
          meetingData: {
            transcript: meetingData.transcript,
            chat_messages: meetingData.chat_messages,
            participants: meetingData.participants,
            summary: meetingData.summary,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI chat failed');

      setAiMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err: any) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Meeting note taker
          </h1>
          <p className="text-slate-600">
            Video, Audio, Transcripts, Participant Events & Metadata
          </p>
        </div>

        {/* Create Bot Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Step 1: Create Meeting Bot</CardTitle>
            <CardDescription>
              Enter your Zoom, Google Meet, or Teams meeting URL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="https://zoom.us/j/123456789 or https://meet.google.com/xxx-xxxx-xxx"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={createBot} disabled={loading || !meetingUrl}>
                {loading ? 'Creating...' : 'Create Bot'}
              </Button>
            </div>

            {botId && (
              <Alert className="mt-4">
                <AlertDescription>
                  <strong>Bot Created!</strong> Bot ID: {botId}
                  <br />
                  {autoRefresh && 'Auto-refreshing status every 5 seconds...'}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Status Display */}
        {meetingData && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Bot Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Badge className={getStatusColor(meetingData.status)}>
                  {meetingData.status}
                </Badge>
                <span className="text-lg">{getStatusMessage(meetingData.status)}</span>
              </div>

              {meetingData.status !== 'done' && (
                <Alert>
                  <AlertDescription>
                    Please wait for the bot to finish processing. This page will auto-refresh.
                    <br />
                    <strong>Current status:</strong> {meetingData.status}
                  </AlertDescription>
                </Alert>
              )}

              {meetingData.status === 'done' && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">
                    <strong>Recording Complete!</strong> All transcript and media files are ready.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={() => fetchMeetingData(false)} 
                disabled={loading}
                className="mt-4"
              >
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Meeting Data Display - Only show when done */}
        {meetingData && meetingData.status === 'done' && (
          <Tabs defaultValue="overview" className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList className="grid w-full grid-cols-8 max-w-5xl">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="meeting">Meeting Info</TabsTrigger>
                <TabsTrigger value="participants">Participants</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="timewise">Time-wise</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="media">Media Files</TabsTrigger>
                <TabsTrigger value="events">Timeline</TabsTrigger>
              </TabsList>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSummary(!showSummary)}
                className="ml-4"
              >
                <Zap className="w-4 h-4" />
              </Button>

              {showSummary && (
                <div className="absolute right-8 top-32 w-96 bg-white rounded-lg shadow-lg p-4 z-50 border border-slate-300">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-slate-900">Meeting Summary</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSummary(false)}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                  <ScrollArea className="h-96">
                    <div className="text-sm space-y-4 pr-4">
                      {meetingData.summary && (
                        <>
                          {/* Overview Stats */}
                          {meetingData.summary.overview && (
                            <div className="bg-slate-50 p-3 rounded">
                              <p className="font-semibold text-slate-900 mb-2">Meeting Stats</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Total Utterances:</span>
                                  <span className="font-medium text-slate-900">{meetingData.summary.overview.total_utterances}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Total Words:</span>
                                  <span className="font-medium text-slate-900">{meetingData.summary.overview.total_words}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Participants:</span>
                                  <span className="font-medium text-slate-900">{meetingData.summary.overview.total_participants}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Chat Messages:</span>
                                  <span className="font-medium text-slate-900">{meetingData.summary.overview.total_chat_messages}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Key Topics */}
                          {meetingData.summary.keywords && Array.isArray(meetingData.summary.keywords) && meetingData.summary.keywords.length > 0 && (
                            <div>
                              <p className="font-semibold text-slate-900 mb-2">Key Topics</p>
                              <div className="flex flex-wrap gap-1">
                                {meetingData.summary.keywords.slice(0, 8).map((kw: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {kw.word}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Most Active Speakers */}
                          {meetingData.summary.most_active_speakers && Array.isArray(meetingData.summary.most_active_speakers) && meetingData.summary.most_active_speakers.length > 0 && (
                            <div>
                              <p className="font-semibold text-slate-900 mb-2">Top Speakers</p>
                              <div className="space-y-2">
                                {meetingData.summary.most_active_speakers.slice(0, 5).map((speaker: any, idx: number) => (
                                  <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                                    <div className="flex justify-between mb-1">
                                      <span className="font-medium text-slate-900">{speaker.name}</span>
                                    </div>
                                    <div className="flex gap-3 text-slate-600">
                                      <span>{speaker.word_count} words</span>
                                      <span>{speaker.utterances} turns</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Meeting Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Status</p>
                      <Badge variant="default">{meetingData.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Duration</p>
                      <p className="text-lg font-semibold">{meetingData.duration?.formatted || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Participants</p>
                      <p className="text-lg font-semibold">{Array.isArray(meetingData.participants) ? meetingData.participants.length : 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Transcript Items</p>
                      <p className="text-lg font-semibold">{Array.isArray(meetingData.transcript) ? meetingData.transcript.length : 0}</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <p className="text-sm text-slate-600 mb-2">Meeting Metadata</p>
                    <pre className="bg-slate-100 p-4 rounded text-xs overflow-auto max-h-60">
                      {JSON.stringify(meetingData.meeting_metadata, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Meeting Info Tab */}
            <TabsContent value="meeting">
              <Card>
                <CardHeader>
                  <CardTitle>Meeting Information</CardTitle>
                  <CardDescription>Details about the meeting recording</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Meeting Title */}
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Meeting Title</p>
                    <p className="text-lg font-semibold">
                      {meetingData.meeting_metadata?.title || 'N/A'}
                    </p>
                  </div>

                  <Separator />

                  {/* Platform & Meeting Details */}
                  <div>
                    <p className="text-sm text-slate-600 mb-3 font-semibold">Meeting Details</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600">Platform</p>
                        <Badge variant="outline" className="mt-1">
                          {meetingData.meeting_url?.platform?.toUpperCase() || 'Unknown'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Meeting ID</p>
                        <p className="text-sm font-mono mt-1">{meetingData.meeting_url?.meeting_id || 'N/A'}</p>
                      </div>
                      {meetingData.meeting_metadata?.zoom?.meeting_uuid && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-600">Meeting UUID</p>
                          <p className="text-sm font-mono mt-1">{meetingData.meeting_metadata.zoom.meeting_uuid}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Recording Timeline */}
                  <div>
                    <p className="text-sm text-slate-600 mb-3 font-semibold">Recording Timeline</p>
                    <div className="space-y-2">
                      {meetingData.status_changes?.filter((change: any) => 
                        ['in_call_recording', 'recording_done', 'done'].includes(change.code)
                      ).map((change: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <span className="font-mono text-sm">{change.code}</span>
                          <span className="text-xs text-slate-600">
                            {new Date(change.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Summary Stats */}
                  {meetingData.summary?.available && (
                    <div>
                      <p className="text-sm text-slate-600 mb-3 font-semibold">Summary</p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-slate-600">Total Utterances</p>
                            <p className="text-lg font-semibold text-blue-900">
                              {meetingData.summary.overview?.total_utterances || 0}
                            </p>
                          </div>
                          <div className="bg-purple-50 p-3 rounded">
                            <p className="text-slate-600">Total Words</p>
                            <p className="text-lg font-semibold text-purple-900">
                              {meetingData.summary.overview?.total_words || 0}
                            </p>
                          </div>
                          <div className="bg-green-50 p-3 rounded">
                            <p className="text-slate-600">Chat Messages</p>
                            <p className="text-lg font-semibold text-green-900">
                              {meetingData.summary.overview?.total_chat_messages || 0}
                            </p>
                          </div>
                          <div className="bg-orange-50 p-3 rounded">
                            <p className="text-slate-600">Participants</p>
                            <p className="text-lg font-semibold text-orange-900">
                              {meetingData.summary.overview?.total_participants || 0}
                            </p>
                          </div>
                        </div>

                        {/* Top Keywords */}
                        {Array.isArray(meetingData.summary.keywords) && meetingData.summary.keywords.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold mb-2">Top Keywords</p>
                            <div className="flex flex-wrap gap-2">
                              {meetingData.summary.keywords.slice(0, 8).map((kw: any, idx: number) => (
                                <Badge key={idx} variant="secondary">
                                  {kw.word} <span className="ml-1 text-xs">({kw.count})</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Most Active Speakers */}
                        {Array.isArray(meetingData.summary.most_active_speakers) && meetingData.summary.most_active_speakers.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold mb-2">Most Active Speakers</p>
                            <div className="space-y-2">
                              {meetingData.summary.most_active_speakers.map((speaker: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                                  <span>{speaker.name}</span>
                                  <div className="flex gap-3 text-xs text-slate-600">
                                    <span>{speaker.word_count} words</span>
                                    <span>{speaker.utterances} utterances</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Participants Tab */}
            <TabsContent value="participants">
              <Card>
                <CardHeader>
                  <CardTitle>Participants ({Array.isArray(meetingData.participants) ? meetingData.participants.length : 0})</CardTitle>
                  <CardDescription>Speaking time and engagement metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {Array.isArray(meetingData.participants) && meetingData.participants.length > 0 ? (
                    <div className="space-y-4">
                      {meetingData.participants.map((participant, idx) => (
                        <Card key={idx}>
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="font-semibold text-lg">{participant.name}</h3>
                              </div>
                              <Badge>{participant.utterances} utterances</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-slate-600">Speaking Time</p>
                                <p className="font-semibold">{participant.speaking_time_formatted || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-slate-600">Words Spoken</p>
                                <p className="font-semibold">{participant.word_count}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>No participant data available yet</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat">
              <Card>
                <CardHeader>
                  <CardTitle>Chat Messages ({meetingData.chat_message_count})</CardTitle>
                  <CardDescription>Live chat during the meeting</CardDescription>
                </CardHeader>
                <CardContent>
                  {Array.isArray(meetingData.chat_messages) && meetingData.chat_messages.length > 0 ? (
                    <ScrollArea className="h-[600px] w-full">
                      <div className="space-y-3 pr-4">
                        {meetingData.chat_messages.map((msg, idx) => (
                          <div key={idx} className="border-l-4 border-green-500 pl-4 py-2 bg-slate-50 p-3 rounded">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-semibold text-green-900">{msg.participant_name}</span>
                              <span className="text-xs text-slate-500">
                                {msg.timestamp_relative_seconds ? `${Math.round(msg.timestamp_relative_seconds)}s` : 'N/A'}
                              </span>
                            </div>
                            <p className="text-slate-800 text-sm">{msg.text}</p>
                            {msg.to && (
                              <p className="text-xs text-slate-600 mt-1">→ to {msg.to}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <Alert>
                      <AlertDescription>No chat messages during this meeting</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transcript Tab */}
            <TabsContent value="transcript">
              <Card>
                <CardHeader>
                  <CardTitle>Full Transcript</CardTitle>
                  <CardDescription>Complete meeting transcript with timestamps</CardDescription>
                </CardHeader>
                <CardContent>
                  {meetingData.transcript.length > 0 ? (
                    <ScrollArea className="h-[600px] w-full">
                      <div className="space-y-4 pr-4">
                        {meetingData.transcript.map((item, idx) => (
                          <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold text-slate-900">
                                {item.participant?.name || item.speaker || 'Unknown'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {item.words?.[0]?.start_timestamp?.absolute || 
                                 (item.start_time ? new Date(item.start_time * 1000).toLocaleTimeString() : '')}
                              </span>
                            </div>
                            <p className="text-slate-700">
                              {item.words?.map((w: any) => w.text).join(' ') || item.text || 'No text'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <Alert>
                      <AlertDescription>No transcript available yet.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Time-wise Transcript Tab */}
            <TabsContent value="timewise">
              <Card>
                <CardHeader>
                  <CardTitle>Time-wise Conversation</CardTitle>
                  <CardDescription>Meeting flow showing all speakers chronologically with chat messages</CardDescription>
                </CardHeader>
                <CardContent>
                  {meetingData.transcript.length > 0 || (Array.isArray(meetingData.chat_messages) && meetingData.chat_messages.length > 0) ? (
                    <ScrollArea className="h-[600px] w-full">
                      <div className="space-y-3 pr-4">
                        {(() => {
                          const events: any[] = [];
                          
                          // Add transcript words as events
                          meetingData.transcript.forEach((item) => {
                            if (Array.isArray(item.words)) {
                              item.words.forEach((word: any) => {
                                events.push({
                                  type: 'speech',
                                  time: word.start_timestamp?.relative || 0,
                                  speaker: item.participant?.name || 'Unknown',
                                  text: word.text,
                                  endTime: word.end_timestamp?.relative,
                                });
                              });
                            }
                          });
                          
                          // Add chat messages as events
                          if (Array.isArray(meetingData.chat_messages)) {
                            meetingData.chat_messages.forEach((msg: any) => {
                              events.push({
                                type: 'chat',
                                time: msg.timestamp_relative_seconds || 0,
                                speaker: msg.participant_name,
                                text: msg.text,
                              });
                            });
                          }
                          
                          // Sort by time
                          events.sort((a, b) => a.time - b.time);
                          
                          // Group consecutive speech events by speaker
                          const grouped: any[] = [];
                          let currentGroup: any = null;
                          
                          events.forEach((event) => {
                            if (event.type === 'chat') {
                              grouped.push(event);
                              currentGroup = null;
                            } else if (event.type === 'speech') {
                              if (currentGroup && currentGroup.speaker === event.speaker) {
                                currentGroup.words.push(event.text);
                              } else {
                                if (currentGroup) grouped.push(currentGroup);
                                currentGroup = {
                                  type: 'speech',
                                  speaker: event.speaker,
                                  time: event.time,
                                  words: [event.text],
                                };
                              }
                            }
                          });
                          
                          if (currentGroup) grouped.push(currentGroup);
                          
                          return grouped.map((event, idx) => {
                            const minutes = Math.floor(event.time / 60);
                            const seconds = Math.floor(event.time % 60);
                            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                            
                            if (event.type === 'chat') {
                              return (
                                <div key={idx} className="border-l-4 border-green-400 pl-4 py-2 bg-green-50 p-3 rounded">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-green-900">{event.speaker}</span>
                                    <span className="text-xs bg-green-200 text-green-900 px-2 py-1 rounded">{timeStr} (Chat)</span>
                                  </div>
                                  <p className="text-slate-800 text-sm">{event.text}</p>
                                </div>
                              );
                            } else {
                              return (
                                <div key={idx} className="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50 p-3 rounded">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-blue-900">{event.speaker}</span>
                                    <span className="text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded">{timeStr}</span>
                                  </div>
                                  <p className="text-slate-800 text-sm">{event.words.join(' ')}</p>
                                </div>
                              );
                            }
                          });
                        })()}
                      </div>
                    </ScrollArea>
                  ) : (
                    <Alert>
                      <AlertDescription>No transcript or chat data available yet.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media Files Tab */}
            <TabsContent value="media">
              <Card>
                <CardHeader>
                  <CardTitle>Media Files</CardTitle>
                  <CardDescription>Download video and audio recordings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {meetingData.media.video_mixed ? (
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <p className="font-semibold">Mixed Video (MP4)</p>
                        <p className="text-sm text-slate-600">All participants combined</p>
                      </div>
                      <Button asChild>
                        <a href={meetingData.media.video_mixed} target="_blank" rel="noopener noreferrer">
                          Download Video
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>Video recording not yet available</AlertDescription>
                    </Alert>
                  )}

                  {meetingData.media.audio_mixed ? (
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <p className="font-semibold">Mixed Audio (MP3)</p>
                        <p className="text-sm text-slate-600">All participants combined</p>
                      </div>
                      <Button asChild>
                        <a href={meetingData.media.audio_mixed} target="_blank" rel="noopener noreferrer">
                          Download Audio
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>Audio recording not yet available</AlertDescription>
                    </Alert>
                  )}

                  {Array.isArray(meetingData.media.audio_separate) && meetingData.media.audio_separate.length > 0 && (
                    <div>
                      <p className="font-semibold mb-2">Separate Audio Tracks</p>
                      {meetingData.media.audio_separate.map((track: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 border rounded mb-2">
                          <div>
                            <p className="font-semibold">{track.participant_name || `Participant ${idx + 1}`}</p>
                            <p className="text-sm text-slate-600">{track.format} - Individual audio track</p>
                          </div>
                          <Button asChild size="sm">
                            <a href={track.url} target="_blank" rel="noopener noreferrer">
                              Download
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Status Timeline Tab */}
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Status Timeline</CardTitle>
                  <CardDescription>Bot status changes throughout the meeting</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] w-full">
                    <div className="space-y-2 pr-4">
                      {meetingData.status_changes.map((change, idx) => (
                        <div key={idx} className="p-3 border rounded flex justify-between items-center">
                          <div>
                            <Badge className={getStatusColor(change.code)}>
                              {change.code}
                            </Badge>
                            {change.sub_code && (
                              <span className="text-sm text-slate-600 ml-2">({change.sub_code})</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(change.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* AI Chat Interface */}
        {meetingData && meetingData.status === 'done' && (
          <div className="fixed bottom-0 right-0 w-96 bg-white shadow-2xl flex flex-col h-screen z-50">
            {/* AI Chat Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center gap-2 flex-shrink-0">
              <MessageCircle className="w-5 h-5" />
              <h3 className="font-semibold">Meeting Assistant</h3>
            </div>

            {/* AI Chat Messages - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
              {aiMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500 text-center">
                    Ask questions about this meeting...
                  </p>
                </div>
              ) : (
                <>
                  {aiMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-lg text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-500 text-white rounded-br-none'
                            : 'bg-white text-slate-900 rounded-bl-none border border-slate-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white text-slate-900 p-3 rounded-lg rounded-bl-none border border-slate-200 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* AI Chat Input - Fixed at Bottom */}
            <div className="border-t border-slate-200 bg-white p-4 flex gap-2 flex-shrink-0">
              <Input
                placeholder="Ask about the meeting..."
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendAIMessage()}
                disabled={aiLoading}
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                onClick={sendAIMessage}
                disabled={aiLoading || !aiInput.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white h-10 px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
