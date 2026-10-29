import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.zwjjpy677njpg.grind',
  appName: 'GRIND',
  webDir: 'dist',
  ios: {
    backgroundColor: '#0B0B0D',
  },
  plugins: {
    // アプリを開いている間は通知を出さない（アプリ内の音と表示で知らせる）
    LocalNotifications: { presentationOptions: [] },
  },
};

export default config;
