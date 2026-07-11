// 建筑模块化孪生系统 - UI控制器

import { BUILDING_TYPES, getAreaNode, getAreaPath, cloneBuildings } from './data.js';
import { BMTSScene } from './scene.js';

export class BMTSUI {
  constructor(user) {
    this.user = user;
    this.canEdit = user.canEdit;
    this.currentAreaId = 'beijing';
    this.areaBuildings = {};
    this.scene3d = null;
    this.currentFilter = 'all';
    this.init();
  }

  init() {
    const container = document.getElementById('scene-container');

    try {
      this.scene3d = new BMTSScene(container);
    } catch (err) {
      console.error('BMTS: 3D场景初始化失败:', err);
      container.innerHTML = '<div style="color:#fff;padding:40px;text-align:center;">3D场景加载失败，请刷新页面重试</div>';
      return;
    }

    // 场景回调
    this.scene3d.onBuildingSelect = (data) => this.onSelectBuilding(data);
    this.scene3d.onBuildingDeselect = () => this.onDeselectBuilding();
    this.scene3d.onBuildingMove = (data) => this.onMoveBuilding(data);
    this.scene3d.onBuildingAdded = (data) => this.onAddBuilding(data);
    this.scene3d.onBuildingDeleted = (id) => this.onDeleteBuilding(id);
    this.scene3d.onPlacingClick = () => this.onPlacingClick();
    this.scene3d.onBuildingHover = (data, event) => this.onHoverBuilding(data, event);
    this.scene3d.onZoneClick = (zoneId) => this.onZoneClick(zoneId);

    this.bindUI();

    // 初始加载北京市
    this.switchToArea('beijing');
  }

  // ===== 区域切换 =====

  switchToArea(areaId) {
    this.currentAreaId = areaId;
    const node = getAreaNode(areaId);
    if (!node) {
      console.error('BMTS: 找不到区域节点:', areaId);
      return;
    }

    // 初始化该区域的建筑数据副本
    if (!this.areaBuildings[areaId] && node.buildings) {
      this.areaBuildings[areaId] = cloneBuildings(node.buildings);
    }

    // 判断显示区域块还是建筑
    if (node.zones && node.zones.length > 0) {
      this.scene3d.loadZones(node.zones, node.levelType);
    } else {
      this.scene3d.loadBuildings(this.areaBuildings[areaId] || []);
    }

    // 更新UI
    this.updateBreadcrumb();
    this.updateStats();
    this.renderBuildingList();
    this.updatePlaceButtons();
    this.hideInfoPanel();
    this.hideActionPanel();
    this.setMode('normal');

    const centerText = document.getElementById('user-bar-center');
    if (centerText) centerText.textContent = this.getPathText();
  }

  getPathText() {
    const path = getAreaPath(this.currentAreaId);
    return path.map(p => p.name).join(' · ');
  }

  onZoneClick(zoneId) {
    const node = getAreaNode(zoneId);
    if (node) {
      this.switchToArea(zoneId);
    } else {
      // 查找children中的zone
      const parentNode = getAreaNode(this.currentAreaId);
      if (parentNode && parentNode.children && parentNode.children[zoneId]) {
        this.switchToArea(zoneId);
      }
    }
  }

  // ===== 面包屑 =====

  updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    const path = getAreaPath(this.currentAreaId);
    bc.innerHTML = '';
    const icons = { beijing: '🏛️', changping: '🏘️', bistu: '🏫' };
    path.forEach(function(node, i) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'bc-sep';
        sep.textContent = '›';
        bc.appendChild(sep);
      }
      const item = document.createElement('span');
      item.className = 'bc-item' + (i === path.length - 1 ? ' current' : '');
      item.textContent = (icons[node.id] || '📍') + ' ' + node.name;
      if (i < path.length - 1) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => this.switchToArea(node.id));
      }
      bc.appendChild(item);
    }.bind(this));
  }

  // ===== UI绑定 =====

  bindUI() {
    const self = this;

    // 放置建筑按钮
    document.querySelectorAll('.place-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!self.canEdit) { self.showToast('查看者无编辑权限', 'warning'); return; }
        if (self.scene3d.viewMode !== 'building') { self.showToast('请先进入建筑区域', 'warning'); return; }
        const type = btn.dataset.type;
        self.scene3d.enterPlaceMode(type);
        self.setMode('place', BUILDING_TYPES[type].label);
        document.getElementById('place-hint').classList.add('active');
        self.hideActionPanel();
      });
    });

    // 确认放置
    document.getElementById('confirm-place-btn').addEventListener('click', function() {
      const name = document.getElementById('place-name-input').value.trim();
      const data = self.scene3d.confirmPlacement(name || undefined);
      if (data) {
        const buildings = self.areaBuildings[self.currentAreaId];
        if (buildings) buildings.push(data);
        self.showToast('建筑已放置: ' + data.name, 'success');
        self.updateStats();
        self.renderBuildingList();
      }
      self.hidePlacePanel();
      self.setMode('normal');
    });

    // 取消放置
    document.getElementById('cancel-place-btn').addEventListener('click', function() {
      self.scene3d.exitPlaceMode();
      self.hidePlacePanel();
      self.setMode('normal');
    });

    // 确认移动
    document.getElementById('confirm-move-btn').addEventListener('click', function() {
      self.showToast('位置已更新', 'success');
      document.getElementById('move-confirm-panel').classList.remove('active');
      self.setMode('normal');
    });

    // 取消移动
    document.getElementById('cancel-move-btn').addEventListener('click', function() {
      document.getElementById('move-confirm-panel').classList.remove('active');
      self.setMode('normal');
    });

    // 删除按钮
    document.getElementById('bap-delete-btn').addEventListener('click', function() {
      if (!self.canEdit) { self.showToast('查看者无删除权限', 'warning'); return; }
      if (!self.scene3d.selectedBuilding) return;
      const data = self.scene3d.selectedBuilding.data;
      if (confirm('确认删除 "' + data.name + '"？')) {
        self.scene3d.deleteBuilding(data.id);
        const buildings = self.areaBuildings[self.currentAreaId];
        if (buildings) {
          const idx = buildings.findIndex(b => b.id === data.id);
          if (idx !== -1) buildings.splice(idx, 1);
        }
        self.showToast('已删除: ' + data.name, 'warning');
        self.hideActionPanel();
        self.hideInfoPanel();
        self.updateStats();
        self.renderBuildingList();
      }
    });

    // 移动按钮
    document.getElementById('bap-move-btn').addEventListener('click', function() {
      if (!self.canEdit) { self.showToast('查看者无编辑权限', 'warning'); return; }
      self.hideActionPanel();
      self.showToast('拖拽建筑到新位置，右键取消', 'info');
    });

    // 关闭操作面板
    document.getElementById('bap-close-btn').addEventListener('click', function() {
      self.hideActionPanel();
    });

    // 关闭详情面板
    document.getElementById('close-info-btn').addEventListener('click', function() {
      self.scene3d.deselectBuilding();
      self.hideActionPanel();
      self.hideInfoPanel();
    });

    // 筛选按钮
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        self.currentFilter = btn.dataset.type;
        self.renderBuildingList();
      });
    });

    // 重置数据
    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        if (confirm('确认重置所有修改？将恢复默认数据。')) {
          self.areaBuildings = {};
          const node = getAreaNode(self.currentAreaId);
          if (node && node.buildings) {
            self.areaBuildings[self.currentAreaId] = cloneBuildings(node.buildings);
          }
          self.switchToArea(self.currentAreaId);
          self.showToast('数据已重置', 'success');
        }
      });
    }

    // 退出登录
    document.getElementById('logout-btn').addEventListener('click', function() {
      if (self.scene3d) self.scene3d.dispose();
      document.getElementById('login-page').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      document.getElementById('login-error').textContent = '';
    });

    // 编辑权限
    if (!this.canEdit) {
      const placeBtns = document.getElementById('place-buttons');
      if (placeBtns) placeBtns.style.display = 'none';
    }
  }

  // ===== 场景回调 =====

  onSelectBuilding(data) {
    if (!data) return;
    this.showInfoPanel(data);
    this.showActionPanel(data);
  }

  onDeselectBuilding() {
    this.hideInfoPanel();
    this.hideActionPanel();
  }

  onMoveBuilding(data) {
    const buildings = this.areaBuildings[this.currentAreaId];
    if (buildings) {
      const idx = buildings.findIndex(b => b.id === data.id);
      if (idx !== -1) {
        buildings[idx].offset = data.offset.slice();
      }
    }
    document.getElementById('move-confirm-panel').classList.add('active');
    this.setMode('move-confirm');
    this.updateInfoPos(data);
    this.renderBuildingList();
  }

  onAddBuilding(data) {}

  onDeleteBuilding(id) {}

  onPlacingClick() {
    document.getElementById('place-hint').classList.remove('active');
    document.getElementById('place-confirm-panel').classList.add('active');
    document.getElementById('place-name-input').focus();
  }

  onHoverBuilding(data, event) {
    const tooltip = document.getElementById('building-tooltip');
    if (!data) {
      tooltip.style.display = 'none';
      return;
    }
    const typeConfig = BUILDING_TYPES[data.type] || BUILDING_TYPES.facility;
    tooltip.innerHTML = '<div class="tt-name">' + typeConfig.icon + ' ' + data.name + '</div>' +
      '<div class="tt-info">' + typeConfig.label + ' · ' + data.floors + '层 · ' + data.area.toLocaleString() + '㎡</div>';
    tooltip.style.display = 'block';
    if (event) {
      tooltip.style.left = (event.clientX + 15) + 'px';
      tooltip.style.top = (event.clientY - 10) + 'px';
    }
  }

  // ===== 面板操作 =====

  showInfoPanel(data) {
    const panel = document.getElementById('info-panel');
    const empty = document.getElementById('info-empty');
    const typeConfig = BUILDING_TYPES[data.type] || BUILDING_TYPES.facility;

    document.getElementById('info-name').textContent = data.name;
    document.getElementById('info-type').textContent = typeConfig.label;
    document.getElementById('info-type-badge').style.background = '#' + typeConfig.color.toString(16).padStart(6, '0');
    document.getElementById('info-type-badge').textContent = typeConfig.label;
    document.getElementById('info-floors').textContent = data.floors;
    document.getElementById('info-area').textContent = data.area.toLocaleString();
    document.getElementById('info-capacity').textContent = data.capacity;
    document.getElementById('info-year').textContent = data.year;
    document.getElementById('info-pos').textContent = '(' + data.offset[0] + ', ' + data.offset[1] + ')';

    panel.classList.add('active');
    empty.style.display = 'none';
  }

  hideInfoPanel() {
    document.getElementById('info-panel').classList.remove('active');
    document.getElementById('info-empty').style.display = '';
  }

  updateInfoPos(data) {
    document.getElementById('info-pos').textContent = '(' + data.offset[0] + ', ' + data.offset[1] + ')';
  }

  showActionPanel(data) {
    const panel = document.getElementById('building-action-panel');
    const typeConfig = BUILDING_TYPES[data.type] || BUILDING_TYPES.facility;

    document.getElementById('bap-icon').textContent = typeConfig.icon;
    document.getElementById('bap-name').textContent = data.name;

    const moveBtn = document.getElementById('bap-move-btn');
    moveBtn.style.display = this.canEdit ? '' : 'none';
    const deleteBtn = document.getElementById('bap-delete-btn');
    deleteBtn.style.display = this.canEdit ? '' : 'none';

    const container = document.getElementById('scene-container');
    const rect = container.getBoundingClientRect();
    panel.style.left = (rect.width / 2 - 100) + 'px';
    panel.style.top = (rect.height - 120) + 'px';
    panel.classList.add('active');
  }

  hideActionPanel() {
    document.getElementById('building-action-panel').classList.remove('active');
  }

  hidePlacePanel() {
    document.getElementById('place-confirm-panel').classList.remove('active');
    document.getElementById('place-hint').classList.remove('active');
    document.getElementById('place-name-input').value = '';
  }

  updatePlaceButtons() {
    const section = document.getElementById('place-buttons');
    if (!section) return;
    const isBuildingView = this.scene3d && this.scene3d.viewMode === 'building';
    section.style.display = (this.canEdit && isBuildingView) ? '' : 'none';
  }

  // ===== 统计 =====

  updateStats() {
    const buildings = this.areaBuildings[this.currentAreaId] || [];
    const counts = {};
    let totalArea = 0;
    buildings.forEach(function(b) {
      counts[b.type] = (counts[b.type] || 0) + 1;
      totalArea += b.area || 0;
    });

    document.getElementById('stat-total').textContent = buildings.length;
    document.getElementById('stat-area').textContent = totalArea.toLocaleString();
    document.getElementById('stat-school').textContent = counts.school || 0;
    document.getElementById('stat-other').textContent = buildings.length - (counts.school || 0);
  }

  // ===== 建筑列表 =====

  renderBuildingList() {
    const list = document.getElementById('building-list');
    const buildings = this.areaBuildings[this.currentAreaId] || [];
    const filter = this.currentFilter;
    const filtered = filter === 'all' ? buildings : buildings.filter(b => b.type === filter);

    // 只有建筑视图才显示列表
    if (this.scene3d && this.scene3d.viewMode === 'zone') {
      list.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">点击区域块进入<br>查看内部建筑</div>';
      return;
    }

    list.innerHTML = '';
    const self = this;
    filtered.forEach(function(b) {
      const typeConfig = BUILDING_TYPES[b.type] || BUILDING_TYPES.facility;
      const item = document.createElement('div');
      item.className = 'building-item';
      item.dataset.id = b.id;
      item.innerHTML = '<span class="building-icon">' + typeConfig.icon + '</span>' +
        '<div class="building-item-info">' +
        '<div class="building-item-name">' + b.name + '</div>' +
        '<div class="building-item-meta">' + typeConfig.label + ' · ' + b.floors + '层 · ' + b.area.toLocaleString() + '㎡</div>' +
        '</div>';
      item.addEventListener('click', function() {
        const bData = self.scene3d.buildings.find(s => s.data.id === b.id);
        if (bData) {
          self.scene3d.selectBuilding(bData);
          self.scene3d.focusOn(bData);
        }
      });
      list.appendChild(item);
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">暂无建筑</div>';
    }
  }

  // ===== 模式 =====

  setMode(mode, label) {
    const indicator = document.getElementById('mode-indicator');
    if (mode === 'place') {
      indicator.textContent = '放置模式：' + label;
      indicator.classList.add('placing');
    } else if (mode === 'move-confirm') {
      indicator.textContent = '确认建筑新位置';
      indicator.classList.add('placing');
    } else {
      indicator.textContent = '浏览模式';
      indicator.classList.remove('placing');
    }
  }

  // ===== Toast =====

  showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 2500);
  }
}
