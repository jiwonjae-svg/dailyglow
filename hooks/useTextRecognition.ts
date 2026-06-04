import { useState, useCallback } from 'react';
import i18n from '../i18n';
import { appLog } from '../services/logger';

type TextRecognitionModuleType = {
  recognize: (imageUrl: string, script?: string) => Promise<{
    text?: string;
    blocks?: Array<{ text?: string }>;
  }>;
};

type TextRecognitionScriptType = {
  LATIN: string;
  CHINESE: string;
  DEVANAGARI: string;
  JAPANESE: string;
  KOREAN: string;
};

let TextRecognitionModule: TextRecognitionModuleType | null = null;
let TextRecognitionScript: TextRecognitionScriptType | null = null;
let isAvailable = false;

try {
  const { NativeModules } = require('react-native');
  const mod = require('@react-native-ml-kit/text-recognition');
  TextRecognitionModule = (mod.default ?? mod) as TextRecognitionModuleType;
  TextRecognitionScript = (mod.TextRecognitionScript ?? null) as TextRecognitionScriptType | null;
  isAvailable = Boolean(NativeModules?.TextRecognition && TextRecognitionModule?.recognize);
} catch {
  // Native OCR is unavailable in Expo Go / web / builds without the linked module.
}

interface UseTextRecognitionReturn {
  recognizedText: string;
  isProcessing: boolean;
  isAvailable: boolean;
  processImage: (uri: string) => Promise<string>;
  reset: () => void;
}

/**
 * On-device OCR hook backed by ML Kit.
 */
export function useTextRecognition(): UseTextRecognitionReturn {
  const [recognizedText, setRecognizedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const resolveRecognitionScript = (): string | undefined => {
    const language = (i18n.resolvedLanguage ?? i18n.language ?? 'ko').split('-')[0].toLowerCase();
    switch (language) {
      case 'ko':
        return TextRecognitionScript?.KOREAN;
      case 'ja':
        return TextRecognitionScript?.JAPANESE;
      case 'zh':
        return TextRecognitionScript?.CHINESE;
      default:
        return TextRecognitionScript?.LATIN;
    }
  };

  const processImage = useCallback(async (uri: string): Promise<string> => {
    if (!isAvailable || !TextRecognitionModule) {
      appLog.warn('[ocr] text recognition unavailable');
      setRecognizedText('');
      return '';
    }

    setIsProcessing(true);
    try {
      const script = resolveRecognitionScript();
      const result = await TextRecognitionModule.recognize(uri, script);
      const blockText = result?.blocks?.map((block) => block.text?.trim() ?? '').filter(Boolean).join('\n') ?? '';
      const rawText = result?.text?.trim() || blockText;
      const text = rawText
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      appLog.log('[ocr] image processed', {
        recognizedChars: text.length,
        language: i18n.resolvedLanguage ?? i18n.language ?? 'ko',
      });

      setRecognizedText(text);
      return text;
    } catch (error) {
      appLog.warn('[ocr] text recognition failed', { error: String(error) });
      setRecognizedText('');
      return '';
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setRecognizedText('');
  }, []);

  return { recognizedText, isProcessing, isAvailable, processImage, reset };
}
