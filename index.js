// File: index.js
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// WhatsApp API configuration
const whatsappApiUrl = 'https://graph.facebook.com/v22.0/';
const phoneNumberId = '641349695719475';
const accessToken = 'EAAeIBK9Ah2EBO49LZAO8RqRFSmMBGyZB5hezmYd8kAo4FIV0ecwUfQLct6ceE4ntg54sstZBKYtImHGZAZAbwRMHmkaPP0rtHX5Eo1liFWKyvYxoyLjq5SXkhBzK0SaXN54Q5fvGVdiyoe9Akuu3dJExWPbdaYQBkgZCCnp3q8TLoJiPUybhb6RlB0wbFuWTtoa14pZAIBFrtoDf2V5ZBgqwODprJb0c3uknDY4ZD';
const verifyToken = 'secret_token';

// Function to send WhatsApp message
async function sendWhatsAppMessage(to, message) {
  try {
    console.log(`Attempting to send message to ${to}: ${message}`);
    
    const response = await fetch(
      `${whatsappApiUrl}${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: message },
        }),
      }
    );
    
    const responseBody = await response.text();
    console.log(`WhatsApp API response: ${responseBody}`);
    
    if (!response.ok) {
      console.error('Error sending WhatsApp message:', responseBody);
      return false;
    }
    
    console.log('Message sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

// Combined webhook handler (for both verification and messages)
app.all('/webhook', async (req, res) => {
  // Handle GET request for webhook verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log(`Received verification request: mode=${mode}, token=${token}, challenge=${challenge}`);
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      return res.status(200).send(challenge);
    } else {
      console.error('Webhook verification failed');
      return res.status(403).send('Verification failed');
    }
  }
  
  // Handle POST request for incoming messages
  if (req.method === 'POST') {
    try {
      // Log the entire incoming request for debugging
      console.log('Webhook POST request body:', JSON.stringify(req.body, null, 2));
      
      // Send immediate 200 OK response to acknowledge receipt
      res.status(200).send('OK');
      
      const body = req.body;
      
      // Check if this is a WhatsApp message notification
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              for (const message of change.value.messages || []) {
                // Only handle text messages
                if (message.type === 'text') {
                  const from = message.from;
                  const text = message.text.body;
                  
                  console.log(`Received message from ${from}: ${text}`);
                  
                  // Echo the same message back
                  await sendWhatsAppMessage(from, text);
                }
              }
            }
          }
        }
      } else {
        console.log('Not a WhatsApp business account object:', body.object);
      }
    } catch (error) {
      console.error('Error in webhook handler:', error);
      // Already sent 200 OK at the beginning
    }
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('WhatsApp Echo Bot is running!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
