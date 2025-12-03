import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Get the signature from headers
    const signature = request.headers.get('svix-signature');
    const timestamp = request.headers.get('svix-timestamp');
    const msgId = request.headers.get('svix-msg-id');

    // Get the raw body for verification
    const bodyText = await request.text();

    // Verify the webhook signature
    const secret = process.env.WEBHOOK_SECRET;
    if (signature && timestamp && msgId && secret) {
      try {
        const signedContent = `${msgId}.${timestamp}.${bodyText}`;
        const secretBytes = Buffer.from(secret.split('_')[1], 'base64');
        const hash = crypto
          .createHmac('sha256', secretBytes)
          .update(signedContent)
          .digest('base64');
        const expectedSig = `v1,${hash}`;

        // Extract the v1 signature from the header
        const headerSigs = signature.split(' ');
        const validSignature = headerSigs.some(
          (sig: string) => sig === `v1,${hash}`
        );

        if (!validSignature) {
          console.warn('⚠️ Invalid webhook signature');
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

        console.log('✅ Webhook signature verified');
      } catch (err) {
        console.warn('⚠️ Signature verification failed:', err);
      }
    }

    const payload = JSON.parse(bodyText);
    const event = payload.event;
    const data = payload.data;

    console.log('\n🔔 WEBHOOK RECEIVED:', event);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Message ID:', msgId);

    if (event === 'bot.status_change') {
      const botId = data.bot_id;
      const status = data.status?.code;
      console.log('   Bot ID:', botId);
      console.log('   Status:', status);

      if (status === 'done') {
        console.log('   ✅ Meeting ended - transcript ready!');
      }
    }

    if (event === 'transcript.data') {
      const speaker = data.data?.participant?.name || 'Unknown';
      const words = data.data?.words || [];
      const text = words.map((w: any) => w.text).join(' ');
      console.log('   💬 Transcript:', speaker, '-', text.substring(0, 100));
    }

    if (event === 'participant_events.join') {
      const participant = data.data?.participant?.name || 'Unknown';
      console.log('   👋 Participant joined:', participant);
    }

    if (event === 'participant_events.leave') {
      const participant = data.data?.participant?.name || 'Unknown';
      console.log('   👋 Participant left:', participant);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('❌ Webhook error:', error.message);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
