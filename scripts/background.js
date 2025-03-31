// 后台脚本，负责长时间运行的任务和与API的通信

// 导入环境配置（如果支持模块导入）
// import { DEFAULT_MODEL, DEFAULT_API_KEY, DEFAULT_API_ENDPOINT } from '../lib/env.js';

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.action === 'generateGreeting') {
    // 调用OpenAI API生成打招呼语
    generateGreeting(request.data)
      .then(greeting => {
        sendResponse({
          success: true,
          greeting: greeting
        });
      })
      .catch(error => {
        console.error('生成打招呼语失败:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    
    return true; // 表示将异步发送响应
  } else if (request.action === 'updateJobInfo') {
    // 存储职位信息到本地存储
    chrome.storage.local.set({
      currentJobInfo: request.data
    }, () => {
      console.log('职位信息已保存到本地存储');
    });
  }
});

// 生成打招呼语
async function generateGreeting(data) {
  const { jobDescription, resumeData, style, settings, onProgress } = data;
  
  // 如果提供了进度回调函数，则调用它
  if (typeof onProgress === 'function') {
    onProgress(10, '正在准备生成数据...');
  }
  
  try {
    // 尝试提取简历文本
    let resumeText = "我是一名求职者，对贵公司的岗位非常感兴趣";
    
    // 如果提供了简历数据，尝试解析
    if (resumeData && resumeData.fileContent) {
      try {
        // 更新进度
        if (typeof onProgress === 'function') {
          onProgress(20, '正在处理简历数据...');
        }
        
        // 如果已经有解析好的简历文本，直接使用
        if (resumeData.resumeText) {
          resumeText = resumeData.resumeText;
        } else {
          // 实际的PDF解析逻辑应该放在这里
          resumeText = `我已上传了简历: ${resumeData.fileName}，我对贵公司的岗位非常感兴趣`;
        }
      } catch (e) {
        console.error('解析简历失败:', e);
        
        // 报告错误
        if (typeof onProgress === 'function') {
          onProgress(30, `简历处理失败: ${e.message}`, true);
        }
      }
    }
    
    // 根据不同风格设置提示词
    let promptStyle = "";
    switch (style) {
      case 'professional':
        promptStyle = "请使用专业、正式的语言风格";
        break;
      case 'enthusiastic':
        promptStyle = "请使用热情、积极的语言风格";
        break;
      case 'concise':
        promptStyle = "请使用简洁、直接的语言风格，控制在100字以内";
        break;
      default:
        promptStyle = "请使用专业的语言风格";
    }
    
    // 更新进度
    if (typeof onProgress === 'function') {
      onProgress(40, '正在准备提示词...');
    }
    
    // 构建完整提示词
    const prompt = `
      你是一位求职者，需要给招聘方发送一条打招呼语。
      ${promptStyle}。
      
      岗位描述:
      ${jobDescription}
      
      我的简历概要:
      ${resumeText}
      
      请根据我的简历和岗位要求，生成一条合适的打招呼语，表达我对这个职位的兴趣和适合度。
      消息应该礼貌专业，突出与岗位最相关的经验和技能，不要过长。
    `;
    
    // 更新进度
    if (typeof onProgress === 'function') {
      onProgress(60, '正在生成打招呼语...');
    }
    
    // 调用Azure OpenAI API
    const response = await callAzureOpenAI(prompt, settings);
    
    // 更新进度
    if (typeof onProgress === 'function') {
      onProgress(90, '打招呼语生成完成!');
    }
    
    return response;
  } catch (error) {
    console.error('生成打招呼语出错:', error);
    
    // 报告错误
    if (typeof onProgress === 'function') {
      onProgress(100, `生成失败: ${error.message}`, true);
    }
    
    throw error;
  } finally {
    // 确保完成进度
    if (typeof onProgress === 'function') {
      onProgress(100, '处理完成');
    }
  }
}

// 调用OpenAI API
async function callAzureOpenAI(prompt, settings) {
  // 从全局变量获取默认值，这样就和env.js中保持一致
  const apiKey = settings?.apiKey || window.DEFAULT_API_KEY || "";
  const baseUrl = settings?.apiEndpoint || window.DEFAULT_API_ENDPOINT || "https://api.bailili.top";
  const model = settings?.model || window.DEFAULT_MODEL || "claude-3-5-haiku-20241022";
  
  try {
    const url = `${baseUrl}/v1/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "你是一个专业的求职顾问，擅长帮助求职者编写专业的打招呼语。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
}

// 扩展安装/更新时执行的逻辑
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // 首次安装时的操作
    const version = chrome.runtime.getManifest().version;
    console.log(`Boss直聘AI助手 v${version} 已安装`);
    
    // 从全局变量获取默认配置
    chrome.storage.local.set({
      defaultApiEndpoint: window.DEFAULT_API_ENDPOINT || 'https://api.bailili.top',
      defaultApiKey: window.DEFAULT_API_KEY || '',
      defaultModel: window.DEFAULT_MODEL || 'claude-3-5-haiku-20241022'
    });
    
    // 打开欢迎页面或设置页面
    chrome.tabs.create({
      url: 'popup/welcome.html'
    });
  } else if (details.reason === 'update') {
    // 更新时的操作
    const version = chrome.runtime.getManifest().version;
    console.log(`Boss直聘AI助手已更新到 v${version}`);
  }
});
