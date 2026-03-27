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
      const primaryRgb = getComputedStyle(document.body).getPropertyValue('--primary-color-rgb').trim() || '66, 133, 244';
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
        border: 1px solid rgba(${primaryRgb}, 0.3);
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
      const primaryRgb = getComputedStyle(document.body).getPropertyValue('--primary-color-rgb').trim() || '66, 133, 244';
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
        border: 1px solid rgba(${primaryRgb}, 0.25);
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

    // dragover - 支持分类拖拽和快捷方式跨分类拖拽
    category._dragOver = (e) => {
      e.preventDefault();

      if (this.draggedType === 'category' && this.draggedElement !== category) {
        // 分类拖拽 - 红色提示
        category.style.borderTop = '2px solid rgba(255, 68, 68, 0.6)';
        category.style.backgroundColor = 'rgba(255, 68, 68, 0.05)';
        category.style.transform = 'scale(1.01)';
        category.style.transition = 'all 0.2s ease';
        category.style.boxShadow = '0 2px 8px rgba(255, 68, 68, 0.15)';
      } else if (this.draggedType === 'shortcut' && this.draggedElement) {
        // 快捷方式跨分类拖拽 - 绿色提示
        const draggedCategory = this.draggedElement.closest('.category-card');
        if (draggedCategory && draggedCategory.dataset.id !== categoryId) {
          category.style.border = '2px solid rgba(52, 168, 83, 0.6)';
          category.style.backgroundColor = 'rgba(52, 168, 83, 0.05)';
          category.style.transform = 'scale(1.02)';
          category.style.transition = 'all 0.2s ease';
          category.style.boxShadow = '0 4px 12px rgba(52, 168, 83, 0.2)';

          // 在分类标题上显示提示
          const header = category.querySelector('.category-header');
          if (header && !header.querySelector('.drop-hint')) {
            const hint = document.createElement('div');
            hint.className = 'drop-hint';
            hint.textContent = '移动到此分类';
            hint.style.cssText = `
              position: absolute;
              top: -25px;
              right: 10px;
              background: rgba(52, 168, 83, 0.9);
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              pointer-events: none;
              z-index: 1000;
            `;
            header.style.position = 'relative';
            header.appendChild(hint);
          }
        }
      }
    };

    // dragleave - 清理样式和提示
    category._dragLeave = (e) => {
      if (!category.contains(e.relatedTarget)) {
        // 清理所有拖拽样式
        category.style.borderTop = '';
        category.style.border = '';
        category.style.backgroundColor = this.draggedElement !== category ? 'rgba(255, 68, 68, 0.02)' : '';
        category.style.transform = this.draggedElement !== category ? 'scale(1.005)' : '';
        category.style.boxShadow = '';

        // 移除提示文字
        const hint = category.querySelector('.drop-hint');
        if (hint) {
          hint.remove();
        }
      }
    };

    // drop - 处理分类拖拽和快捷方式跨分类拖拽
    category._drop = async (e) => {
      e.preventDefault();

      // 清理所有样式
      category.style.borderTop = '';
      category.style.border = '';
      category.style.backgroundColor = '';
      category.style.transform = '';
      category.style.boxShadow = '';

      // 移除提示文字
      const hint = category.querySelector('.drop-hint');
      if (hint) {
        hint.remove();
      }

      if (this.draggedType === 'category' && this.draggedElement !== category) {
        // 分类拖拽
        await this.handleCategoryDrop(categoryId);
      } else if (this.draggedType === 'shortcut' && this.draggedElement) {
        // 快捷方式跨分类拖拽
        const draggedCategory = this.draggedElement.closest('.category-card');
        if (draggedCategory && draggedCategory.dataset.id !== categoryId) {
          await this.handleShortcutDropToCategory(categoryId);
        }
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

    // dragover - 支持跨分类拖拽
    shortcut._dragOver = (e) => {
      e.preventDefault();
      if (this.draggedType === 'shortcut' && this.draggedElement !== shortcut) {
        const draggedCategory = this.draggedElement.closest('.category-card');
        const targetCategory = shortcut.closest('.category-card');

        if (draggedCategory && targetCategory) {
          const isSameCategory = draggedCategory.dataset.id === targetCategory.dataset.id;
          const primaryRgb = getComputedStyle(document.body).getPropertyValue('--primary-color-rgb').trim() || '66, 133, 244';

          if (isSameCategory) {
            // 同分类内排序 - 主色提示
            shortcut.style.borderLeft = `2px solid rgba(${primaryRgb}, 0.6)`;
            shortcut.style.backgroundColor = `rgba(${primaryRgb}, 0.05)`;
            shortcut.style.boxShadow = `0 2px 6px rgba(${primaryRgb}, 0.15)`;
          } else {
            // 跨分类移动 - 绿色提示（语义色保留）
            shortcut.style.borderLeft = '2px solid rgba(52, 168, 83, 0.6)';
            shortcut.style.backgroundColor = 'rgba(52, 168, 83, 0.05)';
            shortcut.style.boxShadow = '0 2px 6px rgba(52, 168, 83, 0.15)';
          }

          shortcut.style.transform = 'scale(1.03)';
          shortcut.style.transition = 'all 0.2s ease';
        }
      }
    };

    // dragleave - 美观版
    shortcut._dragLeave = (e) => {
      if (!shortcut.contains(e.relatedTarget)) {
        shortcut.style.borderLeft = '';
        shortcut.style.backgroundColor = '';
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

      // 保存新顺序
      await storageManager.reorderCategories(categoryIds);

      // 重新渲染
      await categoryManager.renderCategories();

      // 延迟重新初始化
      setTimeout(() => {
        this.init();
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

      if (!draggedCategory || !targetCategory) {
        console.log('❌ 找不到源分类或目标分类');
        return;
      }

      const fromCategoryId = draggedCategory.dataset.id;
      const toCategoryId = targetCategory.dataset.id;
      const isSameCategory = fromCategoryId === toCategoryId;

      if (isSameCategory) {
        // 同分类内重排序
        const shortcuts = storageManager.getSortedShortcuts(fromCategoryId);
        const shortcutIds = shortcuts.map(s => s.id);

        const draggedIndex = shortcutIds.indexOf(this.draggedId);
        const targetIndex = shortcutIds.indexOf(targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
          throw new Error('找不到快捷方式');
        }

        // 重排序
        shortcutIds.splice(draggedIndex, 1);
        shortcutIds.splice(targetIndex, 0, this.draggedId);

        await storageManager.reorderShortcuts(fromCategoryId, shortcutIds);
      } else {
        // 跨分类移动
        const targetShortcuts = storageManager.getSortedShortcuts(toCategoryId);
        const targetIndex = targetShortcuts.findIndex(s => s.id === targetId);

        await storageManager.moveShortcutToCategory(this.draggedId, fromCategoryId, toCategoryId, targetIndex);
      }

      // 重新渲染
      await categoryManager.renderCategories();

      // 延迟重新初始化
      setTimeout(() => {
        this.init();
      }, 300);

    } catch (error) {
      console.error('❌ 快捷方式放置处理失败:', error);
    }
  }

  /**
   * 处理快捷方式拖拽到分类
   */
  async handleShortcutDropToCategory(targetCategoryId) {
    try {
      const draggedCategory = this.draggedElement.closest('.category-card');
      if (!draggedCategory) {
        console.log('❌ 找不到源分类');
        return;
      }

      const fromCategoryId = draggedCategory.dataset.id;

      if (fromCategoryId === targetCategoryId) {
        console.log('❌ 不能拖拽到同一分类');
        return;
      }

      // 移动到目标分类的末尾
      await storageManager.moveShortcutToCategory(this.draggedId, fromCategoryId, targetCategoryId, -1);

      // 重新渲染
      await categoryManager.renderCategories();

      // 延迟重新初始化
      setTimeout(() => {
        this.init();
      }, 300);

    } catch (error) {
      console.error('❌ 快捷方式跨分类拖拽处理失败:', error);
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
    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color').trim() || '#4285f4';
    const primaryRgb = getComputedStyle(document.body).getPropertyValue('--primary-color-rgb').trim() || '66, 133, 244';
    const secondaryColor = getComputedStyle(document.body).getPropertyValue('--secondary-color').trim() || '#34a853';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(${primaryRgb}, 0.4);
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
   * 高亮所有可放置目标 - 支持跨分类拖拽
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
      // 高亮所有分类作为跨分类拖拽目标
      document.querySelectorAll('.category-card').forEach(cat => {
        const draggedCategory = this.draggedElement.closest('.category-card');
        if (draggedCategory && cat.dataset.id !== draggedCategory.dataset.id) {
          // 其他分类 - 绿色提示（跨分类移动）
          cat.style.backgroundColor = 'rgba(52, 168, 83, 0.02)';
          cat.style.transform = 'scale(1.005)';
          cat.style.transition = 'all 0.3s ease';
          cat.classList.add('drop-target-subtle');
        }
      });

      // 高亮所有快捷方式作为排序目标
      document.querySelectorAll('.shortcut').forEach(shortcut => {
        if (shortcut !== this.draggedElement) {
          const draggedCategory = this.draggedElement.closest('.category-card');
          const targetCategory = shortcut.closest('.category-card');

          if (draggedCategory && targetCategory) {
            const isSameCategory = draggedCategory.dataset.id === targetCategory.dataset.id;

            if (isSameCategory) {
              // 同分类 - 主色提示（排序）
              const primaryRgb = getComputedStyle(document.body).getPropertyValue('--primary-color-rgb').trim() || '66, 133, 244';
              shortcut.style.backgroundColor = `rgba(${primaryRgb}, 0.02)`;
            } else {
              // 跨分类 - 绿色提示（移动）
              shortcut.style.backgroundColor = 'rgba(52, 168, 83, 0.02)';
            }

            shortcut.style.transform = 'scale(1.01)';
            shortcut.style.transition = 'all 0.3s ease';
            shortcut.classList.add('drop-target-subtle');
          }
        }
      });
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
   * 重新初始化拖拽功能（在重新渲染后调用）
   */
  reinitialize() {
    this.init();
  }
}

// 创建全局实例
const dragManager = new DragManager();
