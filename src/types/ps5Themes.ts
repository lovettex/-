export interface PS5Theme {
  id: string;
  name: string;
  nameEn: string;
  category: 'interactive';
  iconColor: string;
  bgGradient: [string, string, string];
  accentColor: string;
  particleColor: string;
  particleGlow: string;
  videoSrc?: string;
  cloudFrontUrl?: string;
  sciConcept?: string;
  sciFormula?: string;
  sciDescription?: string;
}

export const PS5_THEMES: PS5Theme[] = [
  {
    id: 'texture-overlay-video',
    name: '主題 1：質感紋理覆蓋',
    nameEn: 'Theme 1: Texture Overlay Video',
    category: 'interactive',
    iconColor: '#10b981',
    bgGradient: ['#f8fafc', '#ecfdf5', '#d1fae5'],
    accentColor: '#059669',
    particleColor: '#34d399',
    particleGlow: 'rgba(16, 185, 129, 0.75)',
    videoSrc:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4',
    cloudFrontUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4',
    sciConcept: 'max-w-[1831px] 居中、底部圓角 rounded-b-[32px] 裁切與 /texture.png 全螢幕輕薄紋理覆蓋 (mix-blend-mode: lighten, opacity: 0.6)',
    sciFormula: 'mix-blend-mode: lighten, opacity: 0.6, rounded-b-[32px]',
    sciDescription:
      'Full-bleed 循環靜音自動播放，外層固定 texture.png 覆蓋層 (z-50) 提供電影感底片顆粒。',
  },
  {
    id: 'anton-cinematic-video',
    name: '主題 2：Anton 劇院視效',
    nameEn: 'Theme 2: Anton Cinematic Video',
    category: 'interactive',
    iconColor: '#38bdf8',
    bgGradient: ['#f8fafc', '#eff6ff', '#dbeafe'],
    accentColor: '#0284c7',
    particleColor: '#38bdf8',
    particleGlow: 'rgba(56, 189, 248, 0.75)',
    videoSrc:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_151551_992053d1-3d3e-4b8c-abac-45f22158f411.mp4',
    cloudFrontUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_151551_992053d1-3d3e-4b8c-abac-45f22158f411.mp4',
    sciConcept: 'max-w-[1831px] 劇院級容器與 Anton 大寫標題 (32px-60px 響應式)',
    sciFormula: 'font: Anton, padding: 64px~96px, uppercase',
    sciDescription:
      'Full-bleed 循環動態背景，結合 Anton 字體的大氣劇院級頂部標題與 generous vertical padding。',
  },
  {
    id: 'fullpage-loop-video',
    name: '全頁無遮罩自動循環動態背景',
    nameEn: 'Full-Page Loop Background Video',
    category: 'interactive',
    iconColor: '#10b981',
    bgGradient: ['#f8fafc', '#f1f5f9', '#e2e8f0'],
    accentColor: '#059669',
    particleColor: '#34d399',
    particleGlow: 'rgba(16, 185, 129, 0.75)',
    videoSrc:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4',
    cloudFrontUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4',
    sciConcept: '全畫面 100% 不透明度無遮罩連續播放 (AutoPlay Loop)',
    sciFormula: 'opacity = 1.0, inset = 0, object-fit = cover',
    sciDescription:
      '語意化 <video> 置於頁面首個子元素，100% 原生畫質無任何漸層、模糊或遮罩濾鏡，自動無限循環播放。',
  },
  {
    id: 'native-scrub-video',
    name: '原生游標水平滑動動態背景',
    nameEn: 'Native Mouse Scrubbing Video',
    category: 'interactive',
    iconColor: '#38bdf8',
    bgGradient: ['#f5f5f5', '#e5e7eb', '#d4d4d8'],
    accentColor: '#0284c7',
    particleColor: '#38bdf8',
    particleGlow: 'rgba(56, 189, 248, 0.75)',
    videoSrc:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4',
    cloudFrontUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4',
    sciConcept: '桌機游標水平位移 Scrubbing / 行動裝置自動播放',
    sciFormula: 'Δt = (Δx / W) × 0.8 × T_duration',
    sciDescription:
      '無遮罩高畫質動態背景，桌機模式 (≥1024px) 隨滑鼠水平移動平滑推算影格時間軸，行動裝置 (<1024px) 自動流暢播放。',
  },
  {
    id: 'lavender-gaze-heart',
    name: '薰衣草愛心互動凝視',
    nameEn: 'Lavender Heart Gaze Scrubbing',
    category: 'interactive',
    iconColor: '#c084fc',
    bgGradient: ['#f5f0ff', '#ede4ff', '#e5d8fc'],
    accentColor: '#a855f7',
    particleColor: '#f472b6',
    particleGlow: 'rgba(192, 132, 252, 0.75)',
    videoSrc: '/footer-scrub.mp4',
    cloudFrontUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260908_073327_03643c0a-db33-417a-ae8f-4a39259c7f9c.mp4',
    sciConcept: '游標視線追蹤互動影格 (1920×1080 24fps Scrubbing)',
    sciFormula: 'θ = atan2(y - y_eye, x - x_eye) ∈ [0, 2π)',
    sciDescription:
      '毛絨薰衣草角色手捧粉紅愛心，隨滑鼠游標方位即時對應錄製影格中之瞳孔視線角度，支援零延遲全關鍵影格跳轉。',
  },
];

