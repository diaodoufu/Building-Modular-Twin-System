// 建筑模块化孪生系统 - 数据层
// 基于真实地理布局建模：北京市→昌平区→北信科沙河校区
// 布局模式：一轴、一环、两区、多组团
// 东西主轴：东门→科技广场→图书馆→西门
// 南北轴：以图书馆为中心
// 教学区（西/北侧）、生活区（东/南侧）
// 水体：西海（图书馆西侧大湖）、燕水（蜿蜒溪流）

// 建筑类型配置
export const BUILDING_TYPES = {
  school:     { label: '教学', color: 0x4a90d9, icon: '🏫' },
  office:     { label: '办公', color: 0x7b8a9e, icon: '🏢' },
  dormitory:  { label: '宿舍', color: 0xe8a84c, icon: '🏠' },
  facility:   { label: '设施', color: 0x5aaa6a, icon: '🏗️' },
  library:    { label: '图书馆', color: 0xc83d3d, icon: '📚' },
  gym:        { label: '体育', color: 0x3ab0d0, icon: '🏟️' },
  canteen:    { label: '餐饮', color: 0xd4a43a, icon: '🍽️' },
};

// ===== 区域层级定义 =====
// offset: [X偏移, Z偏移] 相对场景中心（1单位≈5米）
// size: [宽, 高, 深] 场景单位
// levelType: city / district / institution - 决定相机距离

export const AREA_TREE = {
  id: 'beijing',
  name: '北京市',
  levelType: 'city',
  zones: [
    // 按真实地理方位：西北=昌平，西=海淀，东=朝阳，中西=西城，中东=东城，南=丰台
    { id: 'changping',  name: '昌平区',  offset: [-20, 35],  size: [30, 2, 22],  color: 0x3a8ada },
    { id: 'haidian',    name: '海淀区',  offset: [-35, 5],   size: [22, 2, 18],  color: 0xc83d3d },
    { id: 'chaoyang',   name: '朝阳区',  offset: [35, 5],    size: [28, 2, 22],  color: 0xe8a84c },
    { id: 'xicheng',    name: '西城区',  offset: [-10, -5],  size: [10, 2, 8],   color: 0x5aaa6a },
    { id: 'dongcheng',  name: '东城区',  offset: [10, -5],   size: [10, 2, 8],   color: 0xaa6a3a },
    { id: 'fengtai',    name: '丰台区',  offset: [-5, -25],  size: [20, 2, 16],  color: 0x7a6aba },
  ],
  buildings: [],

  children: {
    changping: {
      id: 'changping',
      name: '昌平区',
      levelType: 'district',
      zones: [
        { id: 'bistu', name: '北京信息科技大学', offset: [0, 0], size: [16, 3, 14], color: 0xc83d3d },
      ],
      buildings: [],

      children: {
        bistu: {
          id: 'bistu',
          name: '北京信息科技大学',
          levelType: 'institution',
          zones: [],
          // 沙河校区真实布局（1单位≈5米）
          // 校区约800m(东西)×500m(南北)，中心原点在图书馆
          // 东西主轴：东门→科技广场→图书馆→西门
          // 教学区：西/北侧（信息楼、工学楼、文理楼、立德楼、科研楼）
          // 生活区：东/南侧（食堂、宿舍、体育馆）
          // 水体：西海（图书馆西侧大湖）、燕水（蜿蜒溪流）
          buildings: [
            // === 中轴线地标：图书馆（临西海湖，校区最大建筑）===
            { id: 1, name: '图书馆',   type: 'library',  offset: [0, 0],      size: [14, 7, 12],  floors: 6, area: 39773,  capacity: 3000, year: 2024 },

            // === 科技广场北侧（教学/办公组团）===
            { id: 2, name: '立德楼',   type: 'office',   offset: [12, -10],   size: [10, 5, 6],   floors: 5, area: 8000,   capacity: 500,  year: 2022 },
            { id: 3, name: '科研楼',   type: 'office',   offset: [12, -6],    size: [8, 5, 6],    floors: 5, area: 6000,   capacity: 400,  year: 2022 },

            // === 图书馆北侧和西侧：教学组团 ===
            { id: 4, name: '信息楼',   type: 'school',   offset: [-5, -8],    size: [10, 5, 7],   floors: 5, area: 8000,   capacity: 1500, year: 2022 },
            { id: 5, name: '工学楼',   type: 'school',   offset: [-10, -4],   size: [10, 6, 8],   floors: 6, area: 10000,  capacity: 2000, year: 2022 },
            { id: 6, name: '文理楼',   type: 'school',   offset: [-8, 5],     size: [10, 5, 7],   floors: 5, area: 59318,  capacity: 1200, year: 2022 },

            // === 科技广场南侧（体育/活动组团）===
            { id: 7, name: '体育馆',   type: 'gym',      offset: [12, 8],     size: [14, 4, 10],  floors: 3, area: 15351,  capacity: 3015, year: 2022 },
            { id: 8, name: '学生发展中心', type: 'facility', offset: [12, 12], size: [8, 3, 6],    floors: 3, area: 4000,   capacity: 300,  year: 2023 },

            // === 校园西南角（室外运动场）===
            { id: 9,  name: '西体育场', type: 'gym',     offset: [-12, 14],   size: [20, 0.5, 14], floors: 1, area: 5000,  capacity: 2000, year: 2020 },

            // === 餐饮区（生活区东侧）===
            { id: 10, name: '学一食堂', type: 'canteen',  offset: [18, -2],   size: [9, 3, 7],    floors: 3, area: 3000,   capacity: 800,  year: 2020 },
            { id: 11, name: '学二食堂', type: 'canteen',  offset: [18, 4],    size: [8, 4, 6],    floors: 4, area: 3500,   capacity: 1000, year: 2022 },

            // === 数据中心（含超市、商铺、理发店、蜜雪冰城等）===
            { id: 12, name: '数据中心', type: 'facility',  offset: [-4, 8],    size: [7, 3, 5],    floors: 3, area: 2000,   capacity: 100,  year: 2022 },

            // === 学生宿舍区（东南侧生活区）===
            { id: 13, name: '学一公寓', type: 'dormitory', offset: [22, -8],   size: [10, 7, 3],   floors: 7, area: 4000,   capacity: '500人', year: 2020 },
            { id: 14, name: '学二公寓', type: 'dormitory', offset: [22, -12],  size: [10, 7, 3],   floors: 7, area: 4000,   capacity: '500人', year: 2020 },
            { id: 15, name: '学三公寓', type: 'dormitory', offset: [18, -14],  size: [10, 7, 3],   floors: 7, area: 4000,   capacity: '500人', year: 2021 },
            { id: 16, name: '学四公寓', type: 'dormitory', offset: [14, -14],  size: [10, 7, 3],   floors: 7, area: 4000,   capacity: '500人', year: 2021 },

            // === 西北侧宿舍（留学生公寓，近北二门）===
            { id: 17, name: '学五公寓', type: 'dormitory', offset: [-14, -8],  size: [9, 6, 3],    floors: 6, area: 3500,   capacity: '300人', year: 2022 },

            // === 校园服务设施 ===
            { id: 18, name: '校医院',   type: 'facility',  offset: [8, 14],    size: [5, 2, 4],    floors: 2, area: 1500,   capacity: 50,   year: 2020 },
            { id: 19, name: '供暖中心', type: 'facility',  offset: [-6, 12],   size: [4, 2, 3],    floors: 2, area: 800,    capacity: 20,   year: 2020 },
          ],
          children: {}
        }
      }
    }
  }
};

// 获取区域节点（递归搜索所有层级）
export function getAreaNode(areaId) {
  if (AREA_TREE.id === areaId) return AREA_TREE;

  function search(children) {
    if (!children) return null;
    for (var key in children) {
      var node = children[key];
      if (node.id === areaId) return node;
      if (node.children) {
        var found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  }

  return search(AREA_TREE.children);
}

// 获取区域路径（用于面包屑）- 递归搜索
export function getAreaPath(areaId) {
  if (AREA_TREE.id === areaId) return [AREA_TREE];

  function search(children, path) {
    if (!children) return null;
    for (var key in children) {
      var node = children[key];
      var newPath = path.concat([node]);
      if (node.id === areaId) return newPath;
      if (node.children) {
        var found = search(node.children, newPath);
        if (found) return found;
      }
    }
    return null;
  }

  return search(AREA_TREE.children, [AREA_TREE]) || [AREA_TREE];
}

// 深拷贝建筑数据
export function cloneBuildings(buildings) {
  return buildings.map(function(b) {
    return Object.assign({}, b, { offset: b.offset.slice(), size: b.size.slice() });
  });
}
