// 建筑模块化孪生系统 - 应用入口

let app = null;
let BMTSUI = null;

async function loadApp() {
  const module = await import('./ui.js');
  BMTSUI = module.BMTSUI;
}

window.__bmtsEnterApp = async function(user) {
  try {
    if (!BMTSUI) {
      await loadApp();
    }

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    document.getElementById('user-name').textContent = user.displayName;
    document.getElementById('user-avatar').textContent = user.avatar;
    document.getElementById('user-role-badge').textContent = user.canEdit ? '管理员' : '查看者';

    app = new BMTSUI(user);
  } catch (err) {
    console.error('BMTS: 应用加载失败:', err);
    var errInfo = err.message || String(err);
    if (err.stack) errInfo += '\n' + err.stack.split('\n').slice(0, 5).join('\n');
    var errorEl = document.getElementById('login-error');
    errorEl.textContent = '加载失败: ' + errInfo;
    errorEl.style.whiteSpace = 'pre-wrap';
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
};

// 预加载模块
loadApp().catch(function(err) {
  console.error('BMTS: 模块预加载失败:', err);
});
