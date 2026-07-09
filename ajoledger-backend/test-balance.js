require('dotenv').config();
const axios = require('axios');

async function checkBalance() {
  const authUrl = 'https://api.nomba.com/v1/auth/token/issue';
  const balanceUrl = `https://api.nomba.com/v1/accounts/${process.env.NOMBA_SUB_ACCOUNT_ID}/balance`;
  
  try {
    const authRes = await axios.post(authUrl, {
      grant_type: 'client_credentials',
      client_id: process.env.NOMBA_CLIENT_ID,
      client_secret: process.env.NOMBA_CLIENT_SECRET,
    }, {
      headers: { 'accountId': process.env.NOMBA_PARENT_ACCOUNT_ID }
    });
    
    const token = authRes.data.data.access_token;
    
    const balRes = await axios.get(balanceUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accountId': process.env.NOMBA_PARENT_ACCOUNT_ID
      }
    });
    
    console.log("Nomba Wallet Balance:", JSON.stringify(balRes.data, null, 2));
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}

checkBalance();
