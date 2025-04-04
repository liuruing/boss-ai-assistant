// 后台脚本，负责长时间运行的任务和与API的通信

// 导入环境配置（如果支持模块导入）
// import { DEFAULT_MODEL, DEFAULT_API_KEY, DEFAULT_API_ENDPOINT } from '../lib/env.js';

/**
 * 从Chrome存储中加载配置
 * @returns {Promise<Object>} - 配置对象
 */
async function loadAPIConfig() {
  return new Promise((resolve) => {
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
      apiKey = apiKey || result.apiKey || window.DEFAULT_API_KEY || '';
      apiEndpoint = apiEndpoint || result.apiEndpoint || window.DEFAULT_API_ENDPOINT || 'https://api.bailili.top';
      model = model || result.model || window.DEFAULT_MODEL || 'claude-3-5-haiku-20241022';
      
      resolve({
        apiKey,
        apiEndpoint,
        model
      });
    });
  });
}

/**
 * 解压缩简历文本
 * @param {string} compressedText - 压缩的Base64文本
 * @returns {Promise<string>} - 解压后的文本
 */
async function decompressResumeText(compressedText) {
  try {
    if (!compressedText) return '';
    
    // 判断是否是压缩的文本
    if (!compressedText.match(/^[A-Za-z0-9+/]+=*$/)) {
      // 如果不是Base64格式，可能是未压缩的文本
      return compressedText;
    }
    
    // 从Base64还原为字节
    const binaryString = atob(compressedText);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 解压缩字节
    const decompressedBytes = await new Promise((resolve, reject) => {
      try {
        // 使用DecompressionStream API解压 (如果浏览器支持)
        if (window.DecompressionStream) {
          const ds = new DecompressionStream('gzip');
          const writer = ds.writable.getWriter();
          writer.write(bytes);
          writer.close();
          
          return new Response(ds.readable)
            .arrayBuffer()
            .then(buffer => resolve(new Uint8Array(buffer)));
        } else {
          // 如果没有可用的解压方法，返回原始bytes
          reject(new Error('没有可用的解压方法'));
        }
      } catch (error) {
        console.error('解压失败，尝试直接解析文本:', error);
        reject(error);
      }
    });
    
    // 转换回文本
    const textDecoder = new TextDecoder();
    const decompressedText = textDecoder.decode(decompressedBytes);
    
    console.log(`简历解压: ${compressedText.length} -> ${decompressedText.length} 字节`);
    return decompressedText;
  } catch (error) {
    console.error('解压简历失败:', error);
    // 解压失败时返回原始文本
    return compressedText;
  }
}

/**
 * 移除文本中的思考过程标签
 * @param {string} text - 原始文本
 * @returns {string} - 处理后的文本
 */
function removeThinkTags(text) {
  if (!text) return "";
  
  // 移除<think>...</think>标签及其内容
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

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
    if (resumeData) {
      try {
        // 更新进度
        if (typeof onProgress === 'function') {
          onProgress(20, '正在处理简历数据...');
        }
        
        // 如果已经有解析好的简历文本，直接使用
        if (resumeData.resumeText) {
          resumeText = resumeData.resumeText;
        } else if (resumeData.compressedText) {
          // 如果有压缩的文本，解压后使用
          resumeText = await decompressResumeText(resumeData.compressedText);
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
    
    // 加载风格配置
    let stylePrompts = [];
    try {
      const result = await new Promise(resolve => 
        chrome.storage.local.get(['stylePromptsJson', 'stylePrompts'], resolve)
      );
      
      if (result.stylePromptsJson) {
        stylePrompts = JSON.parse(result.stylePromptsJson);
      } else {
        stylePrompts = result.stylePrompts || window.DEFAULT_STYLE_PROMPTS;
      }
    } catch (error) {
      console.error('加载风格配置失败:', error);
      // 使用默认风格
      stylePrompts = window.DEFAULT_STYLE_PROMPTS;
    }
    
    // 根据风格ID查找对应的风格提示词
    const selectedStyle = stylePrompts.find(s => s.id === style) || stylePrompts[0];
    let promptStyle = selectedStyle.prompt;
    
    if (!promptStyle) {
      // 默认风格提示词
      promptStyle = "请使用专业的语言风格，突出我的专业能力和经验";
    }
    
    // 更新进度
    if (typeof onProgress === 'function') {
      onProgress(40, '正在准备提示词...');
    }
    
    // 构建完整提示词
    const prompt = `
      你是一位求职者，需要给招聘方发送一条打招呼语。
      ${promptStyle}
      
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
    
    // 获取API配置
    const config = await loadAPIConfig();
    
    // 调用Azure OpenAI API
    const response = await callAzureOpenAI(prompt, config);
    
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
async function callAzureOpenAI(prompt, config) {
  // 使用传入的配置或从存储加载
  const apiKey = config.apiKey || (await loadAPIConfig()).apiKey;
  const baseUrl = config.apiEndpoint || (await loadAPIConfig()).apiEndpoint;
  const model = config.model || (await loadAPIConfig()).model;
  
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
    const generatedText = data.choices[0].message.content.trim();
    // 处理文本，移除thinking标签
    return removeThinkTags(generatedText);
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
    
    // 加载配置并保存默认值
    loadAPIConfig().then(config => {
      // 保存默认配置
      chrome.storage.local.set({
        apiSettingsJson: JSON.stringify({
          apiKey: config.apiKey,
          apiEndpoint: config.apiEndpoint,
          model: config.model
        })
      });
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
