/**
 * 环境配置文件
 */

// API配置
export const DEFAULT_MODEL = 'gpt-3.5-turbo';
export const DEFAULT_API_KEY = 'sk-EBU5uCQ4yHfXTPQ1mqaeRvZTTk0NyCCOd15T9z1z8VJLhz3X';
export const DEFAULT_API_ENDPOINT = 'https://api.bailili.top';

// 确保这些变量也可以通过window对象访问
window.DEFAULT_MODEL = DEFAULT_MODEL;
window.DEFAULT_API_KEY = DEFAULT_API_KEY;
window.DEFAULT_API_ENDPOINT = DEFAULT_API_ENDPOINT;

// 获取版本号函数
export function getVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch (error) {
    console.error('获取版本号失败:', error);
    return '0.1.0';
  }
}

// 默认风格配置
export const DEFAULT_STYLE_PROMPTS = [
  {
    id: 'style1',
    name: '专业正式',
    prompt: '请使用专业、正式的语言风格，突出我的专业能力和经验。语言要精准、有力，展现我的专业素养和行业洞察力。使用适当的行业术语，但避免过度使用专业术语导致晦涩难懂。整体表达要自信但不傲慢，展现我是该领域的专业人才。'
  },
  {
    id: 'style2',
    name: '热情积极',
    prompt: '请使用热情、积极的语言风格，表达我对这个职位的强烈兴趣。语言要充满活力和激情，展现我的主动性和解决问题的热忱。使用积极向上的词汇，表达我对加入团队的期待和为公司创造价值的渴望。整体表达要真诚不做作，展现我的热情和动力。'
  },
  {
    id: 'style3',
    name: '简洁明了',
    prompt: '请使用简洁、直接的语言风格，控制在150字左右，只包含最关键的信息。每句话都要有实际内容，避免空洞的客套话。直接点明我的核心优势和与岗位的匹配点，用最少的文字传达最重要的信息。整体表达要干净利落，展现我高效清晰的沟通能力。'
  },
  {
    id: 'style4',
    name: '友好亲切',
    prompt: '请使用友好、亲切的语言风格，像朋友一样自然交流。语言要平易近人，展现我的真诚和开放性格。使用自然流畅的表达，避免过于刻板的职场用语。适当展示一些个性和热情，但保持专业边界。整体表达要真实可信，展现我是一个容易相处且有团队精神的人。'
  }
]; 