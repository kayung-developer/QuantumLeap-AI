// src/services/authStorage.js
import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'ai.quantumleap.auth';

export const setAuthToken = async (token) => {
  try {
    await Keychain.setGenericPassword('userToken', token, { service: SERVICE_NAME });
  } catch (error) {
    console.error('Keychain Error: Could not save auth token.', error);
  }
};

export const getAuthToken = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE_NAME });
    return credentials ? credentials.password : null;
  } catch (error) {
    console.error('Keychain Error: Could not get auth token.', error);
    return null;
  }
};

export const clearAuthToken = async () => {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE_NAME });
  } catch (error) {
    console.error('Keychain Error: Could not clear auth token.', error);
  }
};