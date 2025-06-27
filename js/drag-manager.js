/**
 * 拖拽管理器
 * 处理分类和快捷方式的拖拽排序功能
 * 支持完整虚影显示和美观的视觉反馈
 */

class DragManager {
  constructor() {
    this.draggedElement = null;
    this.draggedType = null; // 'category' | 'shortcut'
    this.draggedId = null;
    this.isEnabled = true;
  }

  /**
   * 初始化拖拽管理器
   */
  init() {
    this.setupAllDragElements();
  }

  /**
   * 设置所有拖拽元素
   */
  setupAllDragElements() {
    // 设置分类拖拽
    const categories = document.querySelectorAll('.category-card');
    categories.forEach((category) => {
      this.setupCategoryDrag(category);
    });

    // 设置快捷方式拖拽
    const shortcuts = document.querySelectorAll('.shortcut');
    shortcuts.forEach((shortcut) => {
      this.setupShortcutDrag(shortcut);
    });
  }

  /**
   * 设置分类拖拽
   */
  setupCategoryDrag(category) {
    const header = category.querySelector('.category-header');
    const categoryId = category.dataset.id;

    if (!header || !categoryId) return;

    // 不克隆节点，直接清理拖拽相关的事件监听器
    if (header._dragStartHandler) {
      header.removeEventListener('dragstart', header._dragStartHandler);
    }
    if (header._dragEndHandler) {
      header.removeEventListener('dragend', header._dragEndHandler);
    }

    // 设置拖拽属性
    header.draggable = true;
    header.style.cursor = 'grab';

    // 拖拽开始 - 简化稳定版
    header._dragStartHandler = (e) => {
      // 检查是否点击的是按钮
      if (e.target.closest('button')) {
        e.preventDefault();
        return false;
      }


      this.draggedElement = category;
      this.draggedType = 'category';
      this.draggedId = categoryId;

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', categoryId);

      // 创建完整卡片的拖拽虚影
      const ghost = category.cloneNode(true);
      ghost.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: ${category.offsetWidth}px;
        height: ${category.offsetHeight}px;
        margin: 0;
        box-shadow: 0 12px 30px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1);
        transform: rotate(2deg) scale(1.02);
        pointer-events: none;
        filter: brightness(1.05) saturate(1.1);
        border: 1px solid rgba(66, 133, 244, 0.3);
      `;
      document.body.appendChild(ghost);

      // 设置自定义拖拽图像
      const offsetX = ghost.offsetWidth / 2;
      const offsetY = ghost.offsetHeight / 2;
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

      // 清理临时元素
      setTimeout(() => {
        if (ghost.parentNode) {
          ghost.parentNode.removeChild(ghost);
        }
      }, 0);

      // 原始元素反馈
      setTimeout(() => {
        category.style.opacity = '0.5';
        category.style.transform = 'scale(0.95)';
        category.style.transition = 'all 0.3s ease';
        category.style.filter = 'blur(1px)';

        // 添加拖拽指示器
        this.showDragIndicator(category, '正在拖拽分类');

        // 高亮所有可放置的目标
        this.highlightAllDropTargets('category');
      }, 0);
    };

    // 拖拽结束 - 简单稳定版
    header._dragEndHandler = (e) => {

      this.resetDraggedElement();
    };

    header.addEventListener('dragstart', header._dragStartHandler);
    header.addEventListener('dragend', header._dragEndHandler);

    // 确保按钮不会触发拖拽
    const buttons = header.querySelectorAll('button');
    buttons.forEach(button => {
      button.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      button.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // 设置为放置目标
    this.setupCategoryDropTarget(category);


  }

  /**
   * 设置快捷方式拖拽
   */
  setupShortcutDrag(shortcut) {
    const shortcutId = shortcut.dataset.id;
    if (!shortcutId) return;

    // 设置拖拽属性
    shortcut.draggable = true;
    shortcut.style.cursor = 'grab';

    // 清理旧事件
    shortcut.removeEventListener('dragstart', shortcut._dragStart);
    shortcut.removeEventListener('dragend', shortcut._dragEnd);

    // 拖拽开始 - 简化稳定版
    shortcut._dragStart = (e) => {

      this.draggedElement = shortcut;
      this.draggedType = 'shortcut';
      this.draggedId = shortcutId;

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', shortcutId);

      // 创建完整快捷方式的拖拽虚影
      const ghost = shortcut.cloneNode(true);
      ghost.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: ${shortcut.offsetWidth}px;
        height: ${shortcut.offsetHeight}px;
        margin: 0;
        box-shadow: 0 10px 20px rgba(0,0,0,0.15), 0 3px 8px rgba(0,0,0,0.1);
        transform: rotate(1deg) scale(1.05);
        pointer-events: none;
        filter: brightness(1.08) saturate(1.1);
        border: 1px solid rgba(66, 133, 244, 0.25);
      `;
      document.body.appendChild(ghost);

      const offsetX = ghost.offsetWidth / 2;
      const offsetY = ghost.offsetHeight / 2;
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

      setTimeout(() => {
        if (ghost.parentNode) {
          ghost.parentNode.removeChild(ghost);
        }
      }, 0);

      // 原始元素反馈
      setTimeout(() => {
        shortcut.style.opacity = '0.5';
        shortcut.style.transform = 'scale(0.95)';
        shortcut.style.transition = 'all 0.2s ease';

        // 添加拖拽指示器
        this.showDragIndicator(shortcut, '正在拖拽快捷方式');

        // 高亮所有可放置的目标
        this.highlightAllDropTargets('shortcut');
      }, 0);
    };

    // 拖拽结束 - 简单稳定版
    shortcut._dragEnd = (e) => {

      this.resetDraggedElement();
    };

    shortcut.addEventListener('dragstart', shortcut._dragStart);
    shortcut.addEventListener('dragend', shortcut._dragEnd);

    // 设置为放置目标
    this.setupShortcutDropTarget(shortcut);


  }

  /**
   * 设置分类放置目标
   */
  setupCategoryDropTarget(category) {
    const categoryId = category.dataset.id;

    // 清理旧事件
    category.removeEventListener('dragover', category._dragOver);
    category.removeEventListener('dragleave', category._dragLeave);
    category.removeEventListener('drop', category._drop);

    // dragover - 美观版（去掉粗虚线）
    category._dragOver = (e) => {
      e.preventDefault();
      if (this.draggedType === 'category' && this.draggedElement !== category) {
        category.style.borderTop = '2px solid rgba(255, 68, 68, 0.6)';
        category.style.backgroundColor = 'rgba(255, 68, 68, 0.05)';
        category.style.transform = 'scale(1.01)';
        category.style.transition = 'all 0.2s ease';
        category.style.boxShadow = '0 2px 8px rgba(255, 68, 68, 0.15)';
      }
    };

    // dragleave - 美观版
    category._dragLeave = (e) => {
      if (!category.contains(e.relatedTarget)) {
        category.style.borderTop = '';
        category.style.backgroundColor = this.draggedElement !== category ? 'rgba(255, 68, 68, 0.02)' : '';
        category.style.transform = this.draggedElement !== category ? 'scale(1.005)' : '';
        category.style.boxShadow = '';
      }
    };

    // drop - 美观版
    category._drop = async (e) => {
      e.preventDefault();
      category.style.borderTop = '';
      category.style.backgroundColor = '';
      category.style.transform = '';
      category.style.boxShadow = '';

      if (this.draggedType === 'category' && this.draggedElement !== category) {

        await this.handleCategoryDrop(categoryId);
      }
    };

    category.addEventListener('dragover', category._dragOver);
    category.addEventListener('dragleave', category._dragLeave);
    category.addEventListener('drop', category._drop);
  }

  /**
   * 设置快捷方式放置目标
   */
  setupShortcutDropTarget(shortcut) {
    const shortcutId = shortcut.dataset.id;

    // 清理旧事件
    shortcut.removeEventListener('dragover', shortcut._dragOver);
    shortcut.removeEventListener('dragleave', shortcut._dragLeave);
    shortcut.removeEventListener('drop', shortcut._drop);

    // dragover - 美观版（去掉粗虚线）
    shortcut._dragOver = (e) => {
      e.preventDefault();
      if (this.draggedType === 'shortcut' && this.draggedElement !== shortcut) {
        // 检查是否在同一分类
        const draggedCategory = this.draggedElement.closest('.category-card');
        const targetCategory = shortcut.closest('.category-card');

        if (draggedCategory && targetCategory &&
            draggedCategory.dataset.id === targetCategory.dataset.id) {
          shortcut.style.borderLeft = '2px solid rgba(66, 133, 244, 0.6)';
          shortcut.style.backgroundColor = 'rgba(66, 133, 244, 0.05)';
          shortcut.style.transform = 'scale(1.03)';
          shortcut.style.transition = 'all 0.2s ease';
          shortcut.style.boxShadow = '0 2px 6px rgba(66, 133, 244, 0.15)';
        }
      }
    };

    // dragleave - 美观版
    shortcut._dragLeave = (e) => {
      if (!shortcut.contains(e.relatedTarget)) {
        shortcut.style.borderLeft = '';
        shortcut.style.backgroundColor = this.draggedElement !== shortcut ? 'rgba(66, 133, 244, 0.02)' : '';
        shortcut.style.transform = this.draggedElement !== shortcut ? 'scale(1.01)' : '';
        shortcut.style.boxShadow = '';
      }
    };

    // drop - 美观版
    shortcut._drop = async (e) => {
      e.preventDefault();
      shortcut.style.borderLeft = '';
      shortcut.style.backgroundColor = '';
      shortcut.style.transform = '';
      shortcut.style.boxShadow = '';

      if (this.draggedType === 'shortcut' && this.draggedElement !== shortcut) {

        await this.handleShortcutDrop(shortcutId);
      }
    };

    shortcut.addEventListener('dragover', shortcut._dragOver);
    shortcut.addEventListener('dragleave', shortcut._dragLeave);
    shortcut.addEventListener('drop', shortcut._drop);
  }












  /**
   * 处理分类放置
   */
  async handleCategoryDrop(targetId) {
    try {
      console.log('🔄 处理分类放置:', this.draggedId, '->', targetId);

      const categories = storageManager.getSortedCategories();
      const categoryIds = categories.map(cat => cat.id);

      const draggedIndex = categoryIds.indexOf(this.draggedId);
      const targetIndex = categoryIds.indexOf(targetId);

      if (draggedIndex === -1 || targetIndex === -1) {
        throw new Error('找不到分类');
      }

      // 重排序
      categoryIds.splice(draggedIndex, 1);
      categoryIds.splice(targetIndex, 0, this.draggedId);

      console.log('新的分类顺序:', categoryIds);

      // 保存新顺序
      await storageManager.reorderCategories(categoryIds);

      // 重新渲染
      await categoryManager.renderCategories();

      // 延迟重新初始化
      setTimeout(() => {
        this.init();
        console.log('✅ 分类重排序完成，拖拽功能已重新初始化');
      }, 300);

    } catch (error) {
      console.error('❌ 分类放置处理失败:', error);
    }
  }

  /**
   * 处理快捷方式放置
   */
  async handleShortcutDrop(targetId) {
    try {
      const draggedCategory = this.draggedElement.closest('.category-card');
      const targetShortcut = document.querySelector(`[data-id="${targetId}"]`);
      const targetCategory = targetShortcut.closest('.category-card');

      if (!draggedCategory || !targetCategory ||
          draggedCategory.dataset.id !== targetCategory.dataset.id) {
        console.log('❌ 只能在同一分类内重排序快捷方式');
        return;
      }

      const categoryId = draggedCategory.dataset.id;
      console.log('🔄 处理快捷方式放置:', this.draggedId, '->', targetId, '在分类', categoryId);

      const shortcuts = storageManager.getSortedShortcuts(categoryId);
      const shortcutIds = shortcuts.map(s => s.id);

      const draggedIndex = shortcutIds.indexOf(this.draggedId);
      const targetIndex = shortcutIds.indexOf(targetId);

      if (draggedIndex === -1 || targetIndex === -1) {
        throw new Error('找不到快捷方式');
      }

      // 重排序
      shortcutIds.splice(draggedIndex, 1);
      shortcutIds.splice(targetIndex, 0, this.draggedId);

      console.log('新的快捷方式顺序:', shortcutIds);

      // 保存新顺序
      await storageManager.reorderShortcuts(categoryId, shortcutIds);

      // 重新渲染
      await categoryManager.renderCategories();

      // 延迟重新初始化
      setTimeout(() => {
        this.init();
        console.log('✅ 快捷方式重排序完成，拖拽功能已重新初始化');
      }, 300);

    } catch (error) {
      console.error('❌ 快捷方式放置处理失败:', error);
    }
  }

  /**
   * 显示拖拽指示器
   */
  showDragIndicator(element, text) {
    // 移除现有指示器
    this.removeDragIndicator();

    // 创建指示器
    const indicator = document.createElement('div');
    indicator.className = 'drag-indicator';
    indicator.innerHTML = `
      <div class="drag-indicator-content">
        <div class="drag-icon">📦</div>
        <div class="drag-text">${text}</div>
        <div class="drag-hint">拖拽到目标位置释放</div>
      </div>
    `;

    // 设置样式
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      background: linear-gradient(135deg, #4285f4, #34a853);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(66, 133, 244, 0.4);
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      animation: dragIndicatorIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
    `;

    // 添加CSS动画
    if (!document.querySelector('#drag-indicator-styles')) {
      const style = document.createElement('style');
      style.id = 'drag-indicator-styles';
      style.textContent = `
        @keyframes dragIndicatorIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.8); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .drag-indicator-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .drag-icon { font-size: 18px; }
        .drag-text { font-size: 14px; font-weight: 600; }
        .drag-hint { font-size: 12px; opacity: 0.9; }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(indicator);
    this.dragIndicator = indicator;
  }

  /**
   * 移除拖拽指示器
   */
  removeDragIndicator() {
    if (this.dragIndicator) {
      this.dragIndicator.remove();
      this.dragIndicator = null;
    }
  }

  /**
   * 高亮所有可放置目标 - 去掉虚线框版本
   */
  highlightAllDropTargets(type) {
    if (type === 'category') {
      document.querySelectorAll('.category-card').forEach(cat => {
        if (cat !== this.draggedElement) {
          // 使用subtle的背景色提示，不用虚线框
          cat.style.backgroundColor = 'rgba(255, 68, 68, 0.02)';
          cat.style.transform = 'scale(1.005)';
          cat.style.transition = 'all 0.3s ease';
          cat.classList.add('drop-target-subtle');
        }
      });
    } else if (type === 'shortcut') {
      // 只高亮同一分类内的快捷方式
      const draggedCategory = this.draggedElement.closest('.category-card');
      if (draggedCategory) {
        const shortcuts = draggedCategory.querySelectorAll('.shortcut');
        shortcuts.forEach(shortcut => {
          if (shortcut !== this.draggedElement) {
            shortcut.style.backgroundColor = 'rgba(66, 133, 244, 0.02)';
            shortcut.style.transform = 'scale(1.01)';
            shortcut.style.transition = 'all 0.3s ease';
            shortcut.classList.add('drop-target-subtle');
          }
        });
      }
    }
  }

  /**
   * 清理所有高亮 - 去掉虚线框版本
   */
  clearAllHighlights() {
    document.querySelectorAll('.drop-target-subtle').forEach(el => {
      el.style.backgroundColor = '';
      el.style.transform = '';
      el.style.transition = '';
      el.classList.remove('drop-target-subtle');
    });
  }

  /**
   * 重置拖拽元素状态 - 最终优化版
   */
  resetDraggedElement() {
    if (this.draggedElement) {
      this.draggedElement.style.opacity = '';
      this.draggedElement.style.transform = '';
      this.draggedElement.style.transition = '';
      this.draggedElement.style.filter = '';
    }

    // 清理指示器和高亮
    this.removeDragIndicator();
    this.clearAllHighlights();

    // 清理放置目标样式 - 美观版
    document.querySelectorAll('.category-card, .shortcut').forEach(el => {
      el.style.borderTop = '';
      el.style.borderLeft = '';
      el.style.backgroundColor = '';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.transition = '';
    });

    this.draggedElement = null;
    this.draggedType = null;
    this.draggedId = null;
  }





  /**
   * 启用/禁用拖拽功能
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log('DragManager: 拖拽功能', enabled ? '已启用' : '已禁用');
  }

  /**
   * 重新初始化拖拽功能（在重新渲染后调用）
   */
  reinitialize() {
    this.init();
  }

  /**
   * 启用分类拖拽功能（兼容性方法）
   */
  enableCategoryDrag() {
    this.init();
  }

  /**
   * 启用快捷方式拖拽功能（兼容性方法）
   */
  enableShortcutDrag() {
    this.init();
  }

  /**
   * 启用/禁用拖拽功能
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * 重新初始化拖拽功能（在重新渲染后调用）
   */
  reinitialize() {
    this.init();
  }
}

// 创建全局实例
const dragManager = new DragManager();
