export interface GoogleAuthResponse {
  isAuthenticated: boolean;
  user?: {
    email: string;
    name: string;
    picture?: string;
  };
}

export const checkGoogleAuthStatus = async (): Promise<GoogleAuthResponse> => {
  try {
    const response = await fetch('/api/auth/check-session');
    return await response.json();
  } catch (error) {
    console.error('Failed to check Google auth status:', error);
    return { isAuthenticated: false };
  }
};

export const logoutFromGoogle = async (): Promise<void> => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Failed to logout from Google:', error);
    throw error;
  }
};
