/**
 * 环境配置文件
 */

// API配置
export const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
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
    name: '默认风格',
    prompt: '请使用专业、正式的语言风格，突出我的专业能力和相关经验。语言要精准、得体，展现我的专业素养和行业理解。使用适当的行业术语，但保持清晰易懂。整体表达要自信专业，展现我是该领域的合适人选。'
  },
  {
    id: 'style2',
    name: '积极主动',
    prompt: '请使用积极、主动的语言风格，表达我对这个职位的浓厚兴趣。语言要充满活力，展现我的主动性和解决问题的能力。使用积极向上的表达，表达我对加入团队的期待和为公司创造价值的意愿。整体表达要真诚自然，展现我的积极性和专业态度。'
  },
  {
    id: 'style3',
    name: '简洁明了',
    prompt: '请使用简洁、直接的语言风格，控制在150字左右，只包含最关键的信息。每句话都要有实质内容，避免空泛表达。直接说明我的核心优势和与岗位的匹配点，用最少的文字传达最重要的信息。整体表达要简明扼要，展现我高效清晰的沟通能力。'
  },
  {
    id: 'style4',
    name: '诚恳得体',
    prompt: '请使用诚恳、得体的语言风格，自然流畅地表达。语言要平易近人，展现我的真诚和开放态度。使用自然流畅的表达，避免过于刻板的职场用语。适当展示我的专业特点，同时保持专业边界。整体表达要真实可信，展现我是一个容易合作且有团队精神的专业人士。'
  }
]; 