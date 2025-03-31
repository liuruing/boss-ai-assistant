/**
 * PDF和TXT解析工具
 */

class ResumeParser {
  constructor(apiUrl = 'http://127.0.0.1:48000/general/v0/general') {
    this.apiUrl = apiUrl;
  }

  /**
   * 解析简历文件
   * @param {File} file - 简历文件对象
   * @param {string} strategy - 解析策略，默认为'fast'（仅PDF有效）
   * @returns {Promise<Object>} - 解析结果
   */
  async parseResume(file, strategy = 'fast') {
    // 检查文件类型
    if (file.type === 'text/plain') {
      // TXT文件直接读取内容
      return this.parseTxtFile(file);
    } else if (file.type === 'application/pdf') {
      // PDF文件使用API解析
      return this.parsePDF(file, strategy);
    } else {
      throw new Error(`不支持的文件类型: ${file.type}`);
    }
  }

  /**
   * 解析TXT文件
   * @param {File} txtFile - TXT文件对象
   * @returns {Promise<Object>} - 解析结果
   */
  async parseTxtFile(txtFile) {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          const text = event.target.result;
          // 直接返回文本内容，格式化为与API响应类似的结构
          resolve([{ text: text, type: 'NarrativeText' }]);
        };
        
        reader.onerror = (error) => {
          reject(new Error('TXT文件读取失败: ' + error));
        };
        
        reader.readAsText(txtFile);
      });
    } catch (error) {
      console.error('TXT解析失败:', error);
      throw error;
    }
  }

  /**
   * 解析PDF文件
   * @param {File} pdfFile - PDF文件对象
   * @param {string} strategy - 解析策略，默认为'fast'
   * @returns {Promise<Object>} - 解析结果
   */
  async parsePDF(pdfFile, strategy = 'fast') {
    try {
      const formData = new FormData();
      formData.append('files', pdfFile);
      formData.append('strategy', strategy);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('PDF解析失败:', error);
      throw error;
    }
  }

  /**
   * 从解析结果中提取文本内容
   * @param {Object} parseResult - 解析结果
   * @returns {string} - 提取的文本
   */
  extractTextFromResult(parseResult) {
    try {
      if (!Array.isArray(parseResult)) {
        return '';
      }
      
      return parseResult
        .map(item => item.text || '')
        .join('\n')
        .trim();
    } catch (error) {
      console.error('提取文本失败:', error);
      return '';
    }
  }
}

// 导出简历解析器
window.ResumeParser = ResumeParser; 