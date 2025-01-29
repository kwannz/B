import axios from 'axios';

const DEEPSEEK_API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat';

const deepseekClient = axios.create({
  baseURL: DEEPSEEK_API_URL,
  headers: {
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export const generateTradingStrategy = async (prompt: string, model: string = 'deepseek-reasoner') => {
  try {
    const response = await deepseekClient.post('/completions', {
      model,
      messages: [
        { role: "system", content: "You are an AI trading assistant analyzing market data and generating trading strategies." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating trading strategy:', error);
    throw error;
  }
};

export default deepseekClient;
