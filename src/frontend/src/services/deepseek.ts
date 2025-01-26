import axios from 'axios';

const DEEPSEEK_API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v3';

const deepseekClient = axios.create({
  baseURL: DEEPSEEK_API_URL,
  headers: {
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export const generateTradingStrategy = async (prompt: string) => {
  try {
    const response = await deepseekClient.post('/completions', {
      model: 'deepseek-v3',
      prompt,
      max_tokens: 1000,
      temperature: 0.7,
    });
    return response.data.choices[0].text;
  } catch (error) {
    console.error('Error generating trading strategy:', error);
    throw error;
  }
};

export default deepseekClient;
