/**
 * 环境配置文件
 */

// 默认API配置
export const DEFAULT_MODEL = 'deepseek-chat';
export const DEFAULT_API_KEY = 'sk-EBU5uCQ4yHfXTPQ1mqaeRvZTTk0NyCCOd15T9z1z8VJLhz3X';
export const DEFAULT_API_ENDPOINT = 'https://api.bailili.top';

// 确保这些变量也可以通过window对象访问
window.DEFAULT_MODEL = DEFAULT_MODEL;
window.DEFAULT_API_KEY = DEFAULT_API_KEY;
window.DEFAULT_API_ENDPOINT = DEFAULT_API_ENDPOINT;

// 从Chrome存储中加载配置
export function loadConfigFromStorage() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([
        'apiSettingsJson', 
        'apiKey', 
        'apiEndpoint', 
        'model'
      ], (result) => {
        let apiKey, apiEndpoint, model;
        
        // 优先使用JSON格式的API设置
        if (result.apiSettingsJson) {
          try {
            const apiSettings = JSON.parse(result.apiSettingsJson);
            apiKey = apiSettings.apiKey;
            apiEndpoint = apiSettings.apiEndpoint;
            model = apiSettings.model;
          } catch (error) {
            console.error('解析API设置失败:', error);
          }
        }
        
        // 回退到单独的键值
        apiKey = apiKey || result.apiKey || DEFAULT_API_KEY;
        apiEndpoint = apiEndpoint || result.apiEndpoint || DEFAULT_API_ENDPOINT;
        model = model || result.model || DEFAULT_MODEL;
        
        // 更新全局变量
        window.DEFAULT_MODEL = model;
        window.DEFAULT_API_KEY = apiKey;
        window.DEFAULT_API_ENDPOINT = apiEndpoint;
        
        resolve({
          model,
          apiKey,
          apiEndpoint
        });
      });
    } else {
      // 如果不在扩展环境中，使用默认值
      resolve({
        model: DEFAULT_MODEL,
        apiKey: DEFAULT_API_KEY,
        apiEndpoint: DEFAULT_API_ENDPOINT
      });
    }
  });
}

// 初始化时加载配置
loadConfigFromStorage().then(config => {
  console.log('配置已加载:', config.model, config.apiEndpoint);
});

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
    name: '风格1',
    prompt: `# 专业打招呼语生成提示词

我是一个专注于后端开发的程序员，需要一条能够引起招聘方注意的打招呼语。请创建一条：

## 基本结构
- **开头**：直接使用"您好，我"（主语），紧接着突出1-2个与岗位JD高度匹配的核心技能和相关经验。
- **中间部分**：简短提及对公司或岗位的印象，使用自然口语化表达。
- **结束语**：简洁自然地表达对岗位兴趣，例如"很期待能成为团队的一员，为工作贡献我的能力。"

## 语言要求
- 自然流畅，像真人写的而非AI生成。
- 避免过于正式或机械化的表达，如"深感认同"、"高度契合"、"最佳实践"、"技术挑战"等AI常用词汇。
- 使用适当的行业术语，但不要堆砌。

## 禁止使用
- 不介绍姓名。
- 不使用"我是xxx"、"作为一名xxx"、"精通xxx"、"拥有xx年经验"等套话。
- 不使用"技术挑战"、"正巧"、"正是"、"一起构建稳定高效的系统"等不适宜面试打招呼的话语。
- 不使用编号或分点形式。
- 避免空洞的称赞，如"贵司文化令人向往"或无具体内容的泛泛之谈。

## 其他要求
- 总字数严格控制在80字以内。
- 岗位JD的比重更加重要，突出与岗位需求的契合点。
- 直接输出打招呼语内容，无需任何解释。
`
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

// 从Chrome存储中加载风格配置
export function loadStylePromptsFromStorage() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['stylePromptsJson', 'stylePrompts'], (result) => {
        let stylePrompts;
        
        // 优先使用JSON格式
        if (result.stylePromptsJson) {
          try {
            stylePrompts = JSON.parse(result.stylePromptsJson);
          } catch (error) {
            console.error('解析风格配置失败:', error);
          }
        }
        
        // 回退到旧格式
        stylePrompts = stylePrompts || result.stylePrompts || DEFAULT_STYLE_PROMPTS;
        
        // 确保全局访问
        window.DEFAULT_STYLE_PROMPTS = stylePrompts;
        
        resolve(stylePrompts);
      });
    } else {
      // 如果不在扩展环境中，使用默认值
      window.DEFAULT_STYLE_PROMPTS = DEFAULT_STYLE_PROMPTS;
      resolve(DEFAULT_STYLE_PROMPTS);
    }
  });
}

// 初始化时加载风格配置
loadStylePromptsFromStorage().then(stylePrompts => {
  console.log('风格配置已加载，共', stylePrompts.length, '个风格');
}); 