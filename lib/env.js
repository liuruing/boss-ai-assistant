/**
 * 环境配置文件
 */

// API配置
export const DEFAULT_MODEL = 'o3-mini';
export const DEFAULT_API_KEY = 'sk-7rg66CMVkix5YRqvUlst5FHHHa9YHkzbyFKxroSwLxJ3URw3';
export const DEFAULT_API_ENDPOINT = 'https://api.bailili.top';

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
    prompt: '请使用专业、正式的语言风格，突出我的专业能力和经验'
  },
  {
    id: 'style2',
    name: '热情积极',
    prompt: '请使用热情、积极的语言风格，表达我对这个职位的强烈兴趣'
  },
  {
    id: 'style3',
    name: '简洁明了',
    prompt: '请使用简洁、直接的语言风格，控制在100字以内，只包含最关键的信息'
  },
  {
    id: 'style4',
    name: '友好亲切',
    prompt: '请使用友好、亲切的语言风格，像朋友一样自然交流'
  }
]; 