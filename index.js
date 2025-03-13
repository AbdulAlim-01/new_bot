// File: index.js
const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI('AIzaSyCfxGYFjifxYpViB3-IrIpBzkyICerZmDI');
const model = genAI.getGenerativeModel({ model: ' gemini-2.0-flash' });

// WhatsApp API configuration
const whatsappApiUrl = 'https://graph.facebook.com/v22.0/';
const phoneNumberId = '641349695719475';
const accessToken = 'EAAeIBK9Ah2EBOZCkwJb7Cf323G4Knt4LzeZBw0ZCSeFKXgkuEiGZAVP9d29NOtdGUgkAW2fZA3LklMV3sFWfYEcgvS6DI0d3lANJfnJ45ptuj8dGvONwhdWsJZArBLggF79zBoZBLfD84a0poBN6a4oqpnYyOkXIEsD8L6N5Co6sOMf3BiBE9yHXL2zDHNabUxSdy03MfRNK4k8wAAMOiqUPAN0C8fnL14ZAclMV';
const verifyToken = 'secret_token';


// Function to analyze text with Gemini
async function analyzeInventoryUpdate(text) {
  const prompt = `i will give you hindi or english text you're task to analyse three things in each msg 1 item 2 quantity 3 quantity type (kg, pair) 4 action (which is gonna be added or deducted) this is used to manage inventory provide only json no explanation the structure for json is

{
item_name = <original name>,
quantity = ,
quantity_type = <in english>,
action = <added\\deducted>,
}

The text is: "${text}"`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();
    
    // Extract JSON from the response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        // Clean up the response to make it valid JSON
        let jsonString = jsonMatch[0]
          .replace(/=/g, ':')
          .replace(/item_name/g, '"item_name"')
          .replace(/quantity/g, '"quantity"')
          .replace(/quantity_type/g, '"quantity_type"')
          .replace(/action/g, '"action"')
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          .replace(/:\s*([^",\{\}\[\]\s][^,\{\}\[\]]*[^",\{\}\[\]\s])(\s*[,}])/g, ':"$1"$2');
          
        return JSON.parse(jsonString);
      } catch (e) {
        console.error('JSON parsing error:', e);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Gemini API error:', error);
    return null;
  }
}

// Function to send WhatsApp message
async function sendWhatsAppMessage(to, message) {
  try {
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
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook verified successfully');
    return res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed');
    return res.status(403).send('Verification failed');
  }
});

// Webhook for incoming messages
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    // Check if this is a WhatsApp message notification
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            for (const message of change.value.messages || []) {
              // Only handle text messages
              if (message.type === 'text') {
                const from = message.from;
                const text = message.text.body;
                
                console.log(`Received message from ${from}: ${text}`);
                
                // Attempt to analyze any text message as a potential inventory update
                // Since many messages will be in Hindi like "50kilo aata aaya"
                const inventoryData = await analyzeInventoryUpdate(text);
                
                if (inventoryData) {
                  // Send confirmation message
                  const confirmationMessage = `${inventoryData.quantity} ${inventoryData.quantity_type} of ${inventoryData.item_name} ${inventoryData.action}!`;
                  await sendWhatsAppMessage(from, confirmationMessage);
                  console.log(`Sent confirmation: ${confirmationMessage}`);
                } else {
                  await sendWhatsAppMessage(from, "Please send a correct inventory update message.");
                  console.log('Sent error message: Invalid inventory update');
                }
              }
            }
          }
        }
      }
    }
    
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).send('Error processing request');
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('WhatsApp Inventory Bot is running!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
