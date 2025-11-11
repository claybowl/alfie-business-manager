
const GEMINI_API_KEY_STORAGE_KEY = 'gemini-api-key';
const OPENROUTER_API_KEY_STORAGE_KEY = 'openrouter-api-key';
const API_PROVIDER_STORAGE_KEY = 'api-provider';

export type ApiProvider = 'gemini' | 'openrouter';

export const saveApiProvider = (provider: ApiProvider) => {
    localStorage.setItem(API_PROVIDER_STORAGE_KEY, provider);
}

export const getApiProvider = (): ApiProvider => {
    return (localStorage.getItem(API_PROVIDER_STORAGE_KEY) as ApiProvider) || 'gemini';
}

export const saveGeminiApiKey = (key: string) => {
    if (key) {
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
};

export const getCustomGeminiApiKey = (): string | null => {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
};

export const getGeminiApiKey = (): string | undefined => {
    return getCustomGeminiApiKey() || process.env.API_KEY;
}

export const saveOpenRouterApiKey = (key: string) => {
    if (key) {
        localStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(OPENROUTER_API_KEY_STORAGE_KEY);
    }
};

export const getOpenRouterApiKey = (): string | null => {
    return localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY);
};
