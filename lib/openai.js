/**
 * OpenAI API封装
 * 提供与OpenAI API交互的函数
 */

class OpenAIClient {
  /**
   * 创建OpenAI客户端
   * @param {string} apiKey - OpenAI API密钥
   * @param {string} apiBaseUrl - API基础URL
   */
  constructor(apiKey, apiBaseUrl) {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl || window.DEFAULT_API_ENDPOINT || 'https://api.bailili.top';
    // 如果全局变量存在，则使用它，否则使用默认值
    this.model = window.DEFAULT_MODEL || 'gpt-3.5-turbo';
    
    // 尝试从Chrome存储中加载最新配置
    this.loadConfig();
  }
  
  /**
   * 从Chrome存储中加载最新配置
   * @returns {Promise} - 加载完成的Promise
   */
  async loadConfig() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
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
          this.apiKey = apiKey || result.apiKey || this.apiKey;
          this.apiBaseUrl = apiEndpoint || result.apiEndpoint || this.apiBaseUrl;
          this.model = model || result.model || this.model;
          
          console.log('已加载API配置, 模型:', this.model);
          resolve({
            apiKey: this.apiKey,
            apiBaseUrl: this.apiBaseUrl,
            model: this.model
          });
        });
      });
    }
    return Promise.resolve();
  }

  /**
   * 移除文本中的思考过程标签
   * @param {string} text - 原始文本
   * @returns {string} - 处理后的文本
   */
  removeThinkTags(text) {
    if (!text) return "";
    
    // 移除<think>...</think>标签及其内容
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  /**
   * 生成文本内容
   * @param {string} prompt - 提示词
   * @param {Object} options - 选项
   * @returns {Promise<string>} - 生成的文本
   */
  async generateText(prompt, options = {}) {
    // 确保我们使用最新的配置
    await this.loadConfig();
    
    const defaultOptions = {
      temperature: 0.7,
      maxTokens: 800,
      systemMessage: "你是一个专业的求职顾问，擅长帮助求职者编写专业的打招呼语。"
    };

    const settings = { ...defaultOptions, ...options };

    try {
      const url = `${this.apiBaseUrl}/v1/chat/completions`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: settings.systemMessage
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: settings.temperature,
          max_tokens: settings.maxTokens
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API调用失败: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // 检查内容是否为空
      if (!data.choices?.[0]?.message?.content || data.choices[0].message.content.trim() === '') {
        console.error('API返回了空内容:', data);
        // 返回默认文本而不是抛出错误
        return "您好！我对贵公司的这个职位非常感兴趣。我有相关领域的经验和技能，相信能为贵公司创造价值。期待有机会与您详细沟通，谢谢！";
      }

      // 获取生成的文本并移除think标签
      const generatedText = data.choices[0].message.content.trim();
      return this.removeThinkTags(generatedText);
    } catch (error) {
      console.error('生成文本失败:', error);
      // 返回默认文本而不是抛出错误
      return "您好！感谢您查看我的简历。我对这个职位非常感兴趣，并且我相信我的技能和经验与贵公司的需求非常匹配。期待有机会与您进一步交流。";
    }
  }

  /**
   * 生成求职打招呼语
   * @param {Object} data - 数据对象
   * @param {string} data.jobDescription - 岗位描述
   * @param {string} data.resumeText - 简历文本
   * @param {string} data.style - 风格
   * @returns {Promise<string>} - 生成的打招呼语
   */
  async generateJobGreeting(data) {
    // 确保我们使用最新的配置
    await this.loadConfig();
    
    const { jobDescription, resumeText, style = 'professional' } = data;

    // 加载风格配置
    let stylePrompts = window.DEFAULT_STYLE_PROMPTS;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise((resolve) => {
        chrome.storage.local.get(['stylePromptsJson', 'stylePrompts'], (result) => {
          if (result.stylePromptsJson) {
            try {
              stylePrompts = JSON.parse(result.stylePromptsJson);
            } catch (error) {
              console.error('解析风格提示词失败:', error);
              stylePrompts = result.stylePrompts || window.DEFAULT_STYLE_PROMPTS;
            }
          } else {
            stylePrompts = result.stylePrompts || window.DEFAULT_STYLE_PROMPTS;
          }
          resolve();
        });
      });
    }
    
    // 根据ID查找风格
    const selectedStyle = stylePrompts.find(s => s.id === style) || stylePrompts[0];
    let promptStyle = selectedStyle.prompt;
    
    if (!promptStyle) {
      // 默认风格提示词
      promptStyle = "请使用专业的语言风格，突出我的专业能力和经验";
    }

    // 构建用户提示词 - 只包含基本信息
    const userPrompt = `
      岗位描述:
      ${jobDescription}
      
      我的简历概要:
      ${resumeText}
      
      请根据我的简历和岗位要求，生成一条合适的打招呼语，表达我对这个职位的兴趣和适合度。
    `;

    // 构建系统提示词 - 包含所有具体要求
    const systemPrompt = `你是一个专业的求职顾问，擅长帮助求职者编写有针对性的打招呼语。
    
    你需要帮助求职者生成一条打招呼语，风格要求：${promptStyle}。
    
    
    你的回复应当直接是打招呼语内容，不需要任何解释或额外说明。`;

    return this.generateText(userPrompt, {
      systemMessage: systemPrompt,
      temperature: 0.7
    });
  }

  /**
   * 分析简历与岗位匹配度
   * @param {Object} data - 数据对象
   * @param {string} data.jobDescription - 岗位描述
   * @param {string} data.resumeText - 简历文本
   * @param {Function} data.onProgress - 进度回调函数
   * @returns {Promise<Object>} - 分析结果
   */
  async analyzeMatch(data) {
    // 确保我们使用最新的配置
    await this.loadConfig();
    
    const { jobDescription, resumeText, onProgress } = data;
    
    // 如果提供了进度回调函数，则调用它
    if (typeof onProgress === 'function') {
      onProgress(10, '开始准备分析数据...');
    }

    try {
      const prompt = `
        分析以下岗位描述和简历，评估匹配程度，并给出具体的匹配点和不足点。
        
        岗位描述:
        ${jobDescription}
        
        简历:
        ${resumeText}
        
        请提供以下内容:
        1. 总体匹配度评分(1-100)
        2. 优势匹配点（列出3-5条与岗位最匹配的技能或经验）
        3. 可能的不足点（列出1-3条可能不满足岗位要求的方面）
        4. 改进建议（针对不足点，给出1-2条具体的改进建议）
        
        以JSON格式返回结果。
      `;

      // 更新进度
      if (typeof onProgress === 'function') {
        onProgress(30, '正在分析简历与岗位匹配度...');
      }

      const systemMessage = "你是一个专业的HR分析师，擅长分析简历与岗位的匹配程度。";
      
      // 更新进度
      if (typeof onProgress === 'function') {
        onProgress(50, '正在生成分析结果...');
      }
      
      const responseText = await this.generateText(prompt, { 
        systemMessage,
        temperature: 0.3 // 降低随机性，提高一致性
      });

      // 更新进度
      if (typeof onProgress === 'function') {
        onProgress(80, '正在处理分析结果...');
      }

      try {
        // 尝试解析JSON
        const result = JSON.parse(responseText);
        
        // 完成进度
        if (typeof onProgress === 'function') {
          onProgress(100, '分析完成!');
        }
        
        return result;
      } catch (error) {
        // 如果无法解析JSON，返回原文本
        console.error('无法解析JSON结果:', error);
        
        // 报告错误
        if (typeof onProgress === 'function') {
          onProgress(100, '分析完成，但结果格式异常');
        }
        
        return { 
          analysisText: responseText,
          error: '结果格式异常，无法解析为JSON' 
        };
      }
    } catch (error) {
      console.error('分析过程出错:', error);
      
      // 报告错误
      if (typeof onProgress === 'function') {
        onProgress(100, `分析失败: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * PDF简历解析器
   * 注意：此功能需要在后台脚本中实现，因为Chrome扩展中的内容脚本
   * 不能直接解析PDF文件。此处仅为API设计示例。
   * @param {ArrayBuffer} pdfData - PDF数据
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<string>} - 提取的文本
   */
  async parsePdfResume(pdfData, progressCallback) {
    try {
      if (progressCallback) progressCallback(50, '正在分析PDF内容...');
      
      // 直接处理PDF内容
      return this.extractTextFromPdf(pdfData, progressCallback);
    } catch (error) {
      console.error('PDF解析失败:', error);
      throw error;
    }
  }

  // 从PDF中提取文本
  async extractTextFromPdf(pdfData, progressCallback) {
    try {
      // 这里应该使用PDF.js等库来提取文本
      // 为简化实现，这里直接返回一个模拟的结果
      if (progressCallback) progressCallback(70, '提取PDF文本内容...');
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (progressCallback) progressCallback(100, 'PDF解析完成!');
      
      return "这是从PDF中提取的简历内容模拟。实际实现中应该使用PDF解析库。";
    } catch (error) {
      console.error('提取PDF文本失败:', error);
      throw error;
    }
  }
  
  // 解析文件
  async parseFileWithUnstructured(fileDataUri, fileName, progressCallback, apiUrl) {
    try {
      if (progressCallback) progressCallback(10, '准备文件...');
      
      // 从Data URI获取实际的文件数据
      const base64Data = fileDataUri.split(',')[1];
      const fileData = atob(base64Data);
      
      if (progressCallback) progressCallback(30, '连接到解析服务...');
      
      // 将二进制数据转换为Blob
      const arrayBuffer = new ArrayBuffer(fileData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < fileData.length; i++) {
        uint8Array[i] = fileData.charCodeAt(i);
      }
      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      
      // 创建FormData
      const formData = new FormData();
      formData.append('files', blob, fileName);
      formData.append('strategy', 'fast');
      
      if (progressCallback) progressCallback(50, '发送文件到服务器...');
      
      // 发送请求到Unstructured API
      const response = await fetch(`${apiUrl}/general/v0/general`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      if (progressCallback) progressCallback(80, '处理服务器响应...');
      
      const result = await response.json();
      
      // 从结果中提取文本
      let extractedText = '';
      if (Array.isArray(result)) {
        extractedText = result.map(item => item.text || '').join('\n');
      }
      
      if (progressCallback) progressCallback(100, '解析完成!');
      
      return extractedText;
    } catch (error) {
      console.error('解析文件失败:', error);
      throw error;
    }
  }
}

// 导出OpenAIClient类
window.OpenAIClient = OpenAIClient;
