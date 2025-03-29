/**
 * OpenAI API封装
 * 提供与OpenAI API交互的函数
 */

class OpenAIClient {
  /**
   * 创建OpenAI客户端
   * @param {string} apiKey - OpenAI API密钥
   * @param {string} apiBaseUrl - API基础URL
   * @param {string} model - 模型名称
   */
  constructor(apiKey, apiBaseUrl) {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl || 'https://api.bailili.top';
    this.model = 'o3-mini';
  }

  /**
   * 生成文本内容
   * @param {string} prompt - 提示词
   * @param {Object} options - 选项
   * @returns {Promise<string>} - 生成的文本
   */
  async generateText(prompt, options = {}) {
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
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('生成文本失败:', error);
      throw error;
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
    const { jobDescription, resumeText, style = 'professional' } = data;

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

    return this.generateText(prompt);
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
