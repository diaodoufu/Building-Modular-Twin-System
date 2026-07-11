// 建筑模块化孪生系统 - 纯Three.js 3D场景

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BUILDING_TYPES } from './data.js';

// 每层级的相机配置
const CAMERA_CONFIGS = {
  city:       { pos: [0, 150, 150],  target: [0, 0, 0] },       // 市级：俯瞰
  district:   { pos: [0, 100, 100],  target: [0, 0, 0] },       // 区级：中距离
  institution:{ pos: [30, 50, 50],   target: [0, 5, 0] },       // 机构级：近距离编辑，偏移看图书馆
};

export class BMTSScene {
  constructor(container) {
    this.container = container;
    this.buildings = [];
    this.zones = [];
    this.labels = [];
    this.selectedBuilding = null;
    this.hoveredBuilding = null;
    this.hoveredZone = null;
    this.isPlacingMode = false;
    this.placingType = 'school';
    this.placingLocked = false;
    this.isDragging = false;
    this.dragStartWorld = null;
    this.dragStartOffset = null;
    this.collisionDetected = false;
    this.previewGroup = null;
    this.viewMode = 'zone'; // 'zone' or 'building'
    this.controls = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 回调
    this.onBuildingSelect = null;
    this.onBuildingDeselect = null;
    this.onBuildingMove = null;
    this.onBuildingAdded = null;
    this.onBuildingDeleted = null;
    this.onPlacingClick = null;
    this.onBuildingHover = null;
    this.onZoneClick = null;
    this.onPlacingCancel = null;

    this.createScene();
    this.setupEvents();
    this.animate();
  }

  // ===== 创建场景 =====

  createScene() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0e14, 1);
    this.container.appendChild(this.renderer.domElement);

    // 场景
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0e14, 0.002);

    // 相机
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 5000);
    this.camera.position.set(0, 120, 120);
    this.camera.lookAt(0, 0, 0);

    // 轨道控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 500;
    this.controls.maxPolarAngle = Math.PI / 2.1; // 不低于地面
    this.controls.target.set(0, 0, 0);

    // 灯光
    this.addLights();

    // 地面网格
    this.addGround();

    // 放置模式预览
    this.addPreview();
  }

  addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(80, 150, 80);
    dirLight.castShadow = false;
    this.scene.add(dirLight);
    const hemiLight = new THREE.HemisphereLight(0x88aaff, 0x223344, 0.4);
    this.scene.add(hemiLight);
  }

  addGround() {
    // 大网格地面
    const grid = new THREE.GridHelper(400, 40, 0x1a2540, 0x111a2e);
    this.scene.add(grid);

    // 地面平面（用于射线检测）
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = 0;
    this.groundPlane.name = 'ground';
    this.scene.add(this.groundPlane);
  }

  addPreview() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshPhongMaterial({ color: 0x4a90d9, transparent: true, opacity: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    const wireGeo = new THREE.EdgesGeometry(geo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x4a90d9, transparent: true, opacity: 0.8 });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    this.previewGroup = new THREE.Group();
    this.previewGroup.add(mesh);
    this.previewGroup.add(wire);
    this.previewGroup.visible = false;
    this.scene.add(this.previewGroup);
  }

  animate() {
    this._animId = requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ===== 相机切换 =====

  setCameraForLevel(level) {
    const config = CAMERA_CONFIGS[level] || CAMERA_CONFIGS.district;
    // 平滑动画
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(...config.pos);
    const startTarget = this.controls.target.clone();
    const endTarget = new THREE.Vector3(...config.target);

    let t = 0;
    const animateCamera = () => {
      t += 0.03;
      if (t >= 1) {
        this.camera.position.copy(endPos);
        this.controls.target.copy(endTarget);
        this.controls.update();
        return;
      }
      const ease = t * t * (3 - 2 * t); // smoothstep
      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.controls.target.lerpVectors(startTarget, endTarget, ease);
      this.controls.update();
      requestAnimationFrame(animateCamera);
    };
    animateCamera();
  }

  focusOnPosition(x, z) {
    const startTarget = this.controls.target.clone();
    const endTarget = new THREE.Vector3(x, 0, z);
    let t = 0;
    const animateFocus = () => {
      t += 0.04;
      if (t >= 1) {
        this.controls.target.copy(endTarget);
        this.controls.update();
        return;
      }
      const ease = t * t * (3 - 2 * t);
      this.controls.target.lerpVectors(startTarget, endTarget, ease);
      this.controls.update();
      requestAnimationFrame(animateFocus);
    };
    animateFocus();
  }

  // ===== 区域块模型 =====

  createZoneMesh(zoneData) {
    const [w, h, d] = zoneData.size;
    const group = new THREE.Group();

    // 半透明方块
    const mat = new THREE.MeshPhongMaterial({
      color: zoneData.color, transparent: true, opacity: 0.3, flatShading: true
    });
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = h / 2;
    group.add(mesh);

    // 边框
    const edgeMat = new THREE.LineBasicMaterial({ color: zoneData.color, transparent: true, opacity: 0.9 });
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.y = h / 2;
    group.add(edges);

    // 定位
    group.position.set(zoneData.offset[0], 0, zoneData.offset[1]);

    group.userData = {
      zoneData: zoneData,
      originalColor: zoneData.color,
      type: 'zone'
    };

    return group;
  }

  createZoneLabel(zoneData) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 96;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 96, 10);
    ctx.fill();
    ctx.strokeStyle = '#' + zoneData.color.toString(16).padStart(6, '0');
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zoneData.name, 256, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95 });
    const sprite = new THREE.Sprite(spriteMat);
    const labelScale = Math.max(zoneData.size[0], zoneData.size[2]) * 0.3;
    sprite.scale.set(labelScale * 2, labelScale * 0.4, 1);
    sprite.position.set(zoneData.offset[0], zoneData.size[1] + labelScale * 0.3, zoneData.offset[1]);
    sprite.name = 'zone-label-' + zoneData.id;

    return sprite;
  }

  // ===== 建筑模型 =====

  createBuildingMesh(building) {
    const typeConfig = BUILDING_TYPES[building.type] || BUILDING_TYPES.facility;
    const [w, h, d] = building.size;
    const group = new THREE.Group();

    const material = new THREE.MeshPhongMaterial({
      color: typeConfig.color, transparent: true, opacity: 0.9, flatShading: true
    });
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });

    // ====== 图书馆：方圆之间 + 信息束 ======
    if (building.type === 'library') {
      // 主体方体（略有退台）
      const mainGeo = new THREE.BoxGeometry(w, h * 0.85, d);
      const mainMesh = new THREE.Mesh(mainGeo, material);
      mainMesh.position.y = h * 0.85 / 2;
      group.add(mainMesh);

      const edgeGeo = new THREE.EdgesGeometry(mainGeo);
      const edges = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edges.position.y = h * 0.85 / 2;
      group.add(edges);

      // 上层退台
      const upperGeo = new THREE.BoxGeometry(w * 0.85, h * 0.15, d * 0.85);
      const upperMesh = new THREE.Mesh(upperGeo, material);
      upperMesh.position.y = h * 0.85 + h * 0.15 / 2;
      group.add(upperMesh);

      const upperEdge = new THREE.EdgesGeometry(upperGeo);
      const upperEdges = new THREE.LineSegments(upperEdge, edgeMaterial);
      upperEdges.position.y = h * 0.85 + h * 0.15 / 2;
      group.add(upperEdges);

      // 玻璃幕墙窗户网格（正面+背面）
      const glassMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
      for (let wy = 1.5; wy < h * 0.85; wy += 1.5) {
        for (let wx = -w / 2 + 1; wx < w / 2; wx += 1.3) {
          const winGeo = new THREE.PlaneGeometry(0.7, 0.9);
          const win = new THREE.Mesh(winGeo, glassMat);
          win.position.set(wx, wy, d / 2 + 0.02);
          group.add(win);
          const win2 = new THREE.Mesh(winGeo, glassMat);
          win2.position.set(wx, wy, -d / 2 - 0.02);
          win2.rotation.y = Math.PI;
          group.add(win2);
        }
      }

      // 信息束 - 树形向上生长的中庭核心（下粗上细圆柱）
      const beamH = h * 0.6;
      const beamGeo = new THREE.CylinderGeometry(w * 0.12, w * 0.2, beamH, 16);
      const beamMat = new THREE.MeshPhongMaterial({
        color: 0xffffff, transparent: true, opacity: 0.75, flatShading: true
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = h + beamH / 2;
      group.add(beam);

      // 信息束顶部球形
      const topSphereGeo = new THREE.SphereGeometry(w * 0.15, 16, 12);
      const topSphere = new THREE.Mesh(topSphereGeo, beamMat);
      topSphere.position.y = h + beamH + w * 0.08;
      group.add(topSphere);

      // 信息束边框
      const beamEdge = new THREE.EdgesGeometry(beamGeo);
      const beamEdgeMesh = new THREE.LineSegments(beamEdge, new THREE.LineBasicMaterial({ color: typeConfig.color, opacity: 0.6, transparent: true }));
      beamEdgeMesh.position.y = h + beamH / 2;
      group.add(beamEdgeMesh);

      // 信息束发光环
      const ringGeo = new THREE.TorusGeometry(w * 0.18, 0.08, 8, 24);
      const ringMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, emissive: 0x224466 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h + beamH * 0.6;
      group.add(ring);

    // ====== 体育场（西体育场）：400m椭圆跑道 ======
    } else if (building.type === 'gym' && h <= 1) {
      // 400m标准跑道 - 使用Shape创建圆角矩形跑道
      const trackShape = new THREE.Shape();
      const rw = w * 0.5;
      const rd = d * 0.5;
      const r = Math.min(rw, rd) * 0.35;
      trackShape.moveTo(-rw + r, -rd);
      trackShape.lineTo(rw - r, -rd);
      trackShape.quadraticCurveTo(rw, -rd, rw, -rd + r);
      trackShape.lineTo(rw, rd - r);
      trackShape.quadraticCurveTo(rw, rd, rw - r, rd);
      trackShape.lineTo(-rw + r, rd);
      trackShape.quadraticCurveTo(-rw, rd, -rw, rd - r);
      trackShape.lineTo(-rw, -rd + r);
      trackShape.quadraticCurveTo(-rw, -rd, -rw + r, -rd);

      // 内圈（足球场区域）
      const innerW = rw - 1.5;
      const innerD = rd - 1.5;
      const ir = Math.min(innerW, innerD) * 0.35;
      const innerPath = new THREE.Path();
      innerPath.moveTo(-innerW + ir, -innerD);
      innerPath.lineTo(innerW - ir, -innerD);
      innerPath.quadraticCurveTo(innerW, -innerD, innerW, -innerD + ir);
      innerPath.lineTo(innerW, innerD - ir);
      innerPath.quadraticCurveTo(innerW, innerD, innerW - ir, innerD);
      innerPath.lineTo(-innerW + ir, innerD);
      innerPath.quadraticCurveTo(-innerW, innerD, -innerW, innerD - ir);
      innerPath.lineTo(-innerW, -innerD + ir);
      innerPath.quadraticCurveTo(-innerW, -innerD, -innerW + ir, -innerD);
      trackShape.holes.push(innerPath);

      const trackGeo = new THREE.ShapeGeometry(trackShape, 32);
      const trackMat = new THREE.MeshPhongMaterial({ color: 0xcc3333, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const track = new THREE.Mesh(trackGeo, trackMat);
      track.rotation.x = -Math.PI / 2;
      track.position.y = 0.05;
      group.add(track);

      // 外跑道边线（蓝色）
      const outerTrackShape = new THREE.Shape();
      const or2 = r + 0.3;
      const orw = rw + 0.3, ord = rd + 0.3;
      outerTrackShape.moveTo(-orw + or2, -ord);
      outerTrackShape.lineTo(orw - or2, -ord);
      outerTrackShape.quadraticCurveTo(orw, -ord, orw, -ord + or2);
      outerTrackShape.lineTo(orw, ord - or2);
      outerTrackShape.quadraticCurveTo(orw, ord, orw - or2, ord);
      outerTrackShape.lineTo(-orw + or2, ord);
      outerTrackShape.quadraticCurveTo(-orw, ord, -orw, ord - or2);
      outerTrackShape.lineTo(-orw, -ord + or2);
      outerTrackShape.quadraticCurveTo(-orw, -ord, -orw + or2, -ord);
      const outerHole = new THREE.Path();
      outerHole.moveTo(-rw + r, -rd);
      outerHole.lineTo(rw - r, -rd);
      outerHole.quadraticCurveTo(rw, -rd, rw, -rd + r);
      outerHole.lineTo(rw, rd - r);
      outerHole.quadraticCurveTo(rw, rd, rw - r, rd);
      outerHole.lineTo(-rw + r, rd);
      outerHole.quadraticCurveTo(-rw, rd, -rw, rd - r);
      outerHole.lineTo(-rw, -rd + r);
      outerHole.quadraticCurveTo(-rw, -rd, -rw + r, -rd);
      outerTrackShape.holes.push(outerHole);
      const outerGeo = new THREE.ShapeGeometry(outerTrackShape, 32);
      const outerMat = new THREE.MeshPhongMaterial({ color: 0x3355aa, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const outerTrack = new THREE.Mesh(outerGeo, outerMat);
      outerTrack.rotation.x = -Math.PI / 2;
      outerTrack.position.y = 0.04;
      group.add(outerTrack);

      // 内场足球场（绿色）
      const fieldGeo = new THREE.PlaneGeometry(innerW * 2 - 1, innerD * 2 - 1);
      const fieldMat = new THREE.MeshPhongMaterial({ color: 0x2d8a4e, transparent: true, opacity: 0.85 });
      const field = new THREE.Mesh(fieldGeo, fieldMat);
      field.rotation.x = -Math.PI / 2;
      field.position.y = 0.06;
      group.add(field);

      // 看台（北侧）
      const standGeo = new THREE.BoxGeometry(w * 0.9, 2.5, 2.5);
      const standMat = new THREE.MeshPhongMaterial({ color: 0x556677, transparent: true, opacity: 0.8, flatShading: true });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(0, 1.25, -rd - 1.8);
      group.add(stand);
      // 看台阶梯效果
      for (let si = 0; si < 3; si++) {
        const stepGeo = new THREE.BoxGeometry(w * 0.88, 0.3, 0.7);
        const step = new THREE.Mesh(stepGeo, new THREE.MeshPhongMaterial({ color: 0x667788, transparent: true, opacity: 0.7 }));
        step.position.set(0, 0.5 + si * 0.7, -rd - 0.8 - si * 0.6);
        group.add(step);
      }

    // ====== 体育馆：大跨度弧形屋顶 ======
    } else if (building.type === 'gym') {
      // 主体墙体（较矮的box）
      const wallH = h * 0.55;
      const wallGeo = new THREE.BoxGeometry(w, wallH, d);
      const wallMesh = new THREE.Mesh(wallGeo, material);
      wallMesh.position.y = wallH / 2;
      group.add(wallMesh);

      const wallEdge = new THREE.EdgesGeometry(wallGeo);
      const wallEdges = new THREE.LineSegments(wallEdge, edgeMaterial);
      wallEdges.position.y = wallH / 2;
      group.add(wallEdges);

      // 弧形屋顶（半圆柱）
      const roofRadius = w * 0.5;
      const roofGeo = new THREE.CylinderGeometry(roofRadius, roofRadius, d, 24, 1, false, 0, Math.PI);
      const roofMat = new THREE.MeshPhongMaterial({ color: typeConfig.color, transparent: true, opacity: 0.85, flatShading: true });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.y = wallH;
      group.add(roof);

      // 屋顶边框
      const roofEdge = new THREE.EdgesGeometry(roofGeo);
      const roofEdgeMesh = new THREE.LineSegments(roofEdge, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true }));
      roofEdgeMesh.rotation.z = Math.PI / 2;
      roofEdgeMesh.rotation.y = Math.PI / 2;
      roofEdgeMesh.position.y = wallH;
      group.add(roofEdgeMesh);

      // 入口雨棚
      const canopyGeo = new THREE.BoxGeometry(w * 0.4, 0.15, 2);
      const canopyMat = new THREE.MeshPhongMaterial({ color: 0x555555, transparent: true, opacity: 0.7 });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(0, wallH * 0.5, d / 2 + 1);
      group.add(canopy);
      // 雨棚支柱
      for (let px = -1; px <= 1; px += 2) {
        const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, wallH * 0.5, 8);
        const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshPhongMaterial({ color: 0x444444 }));
        pillar.position.set(px * w * 0.18, wallH * 0.25, d / 2 + 1);
        group.add(pillar);
      }

    // ====== 教学楼（信息楼、工学楼、文理楼）======
    } else if (building.type === 'school') {
      // 主体
      const mainGeo = new THREE.BoxGeometry(w, h, d);
      const mainMesh = new THREE.Mesh(mainGeo, material);
      mainMesh.position.y = h / 2;
      group.add(mainMesh);

      const edgeGeo = new THREE.EdgesGeometry(mainGeo);
      const edges = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edges.position.y = h / 2;
      group.add(edges);

      // 玻璃幕墙窗户网格（正面+侧面）
      const glassMat = new THREE.MeshPhongMaterial({ color: 0x88bbee, transparent: true, opacity: 0.5 });
      for (let wy = 1.2; wy < h; wy += 1.3) {
        for (let wx = -w / 2 + 0.8; wx < w / 2; wx += 1.2) {
          const winGeo = new THREE.PlaneGeometry(0.6, 0.8);
          const win = new THREE.Mesh(winGeo, glassMat);
          win.position.set(wx, wy, d / 2 + 0.02);
          group.add(win);
        }
      }
      // 侧面窗户
      for (let wy = 1.2; wy < h; wy += 1.3) {
        for (let wz = -d / 2 + 0.8; wz < d / 2; wz += 1.2) {
          const winGeo = new THREE.PlaneGeometry(0.6, 0.8);
          const win = new THREE.Mesh(winGeo, glassMat);
          win.rotation.y = Math.PI / 2;
          win.position.set(w / 2 + 0.02, wy, wz);
          group.add(win);
        }
      }

      // 入口雨棚
      const canopyGeo = new THREE.BoxGeometry(w * 0.3, 0.12, 1.5);
      const canopyMat = new THREE.MeshPhongMaterial({ color: 0x556677, transparent: true, opacity: 0.7 });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(0, h * 0.35, d / 2 + 0.75);
      group.add(canopy);
      // 雨棚支柱
      for (let px = -1; px <= 1; px += 2) {
        const pillarGeo = new THREE.CylinderGeometry(0.08, 0.08, h * 0.35, 8);
        const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshPhongMaterial({ color: 0x444444 }));
        pillar.position.set(px * w * 0.13, h * 0.35 / 2, d / 2 + 1.4);
        group.add(pillar);
      }

    // ====== 办公楼（立德楼、科研楼）======
    } else if (building.type === 'office') {
      // 主体（更正式、更高比例）
      const mainGeo = new THREE.BoxGeometry(w, h, d);
      const mainMesh = new THREE.Mesh(mainGeo, material);
      mainMesh.position.y = h / 2;
      group.add(mainMesh);

      const edgeGeo = new THREE.EdgesGeometry(mainGeo);
      const edges = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edges.position.y = h / 2;
      group.add(edges);

      // 水平玻璃带（横向条窗）
      const bandMat = new THREE.MeshPhongMaterial({ color: 0x99ccff, transparent: true, opacity: 0.45 });
      for (let wy = 1; wy < h; wy += 1.2) {
        const bandGeo = new THREE.PlaneGeometry(w * 0.92, 0.5);
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.set(0, wy, d / 2 + 0.02);
        group.add(band);
        const band2 = new THREE.Mesh(bandGeo, bandMat);
        band2.position.set(0, wy, -d / 2 - 0.02);
        band2.rotation.y = Math.PI;
        group.add(band2);
      }

      // 入口门廊（门柱+横梁）
      const porticoW = w * 0.35;
      const porticoH = h * 0.3;
      const porticoD = 1.5;
      for (let px = -1; px <= 1; px += 2) {
        const colGeo = new THREE.CylinderGeometry(0.15, 0.18, porticoH, 8);
        const col = new THREE.Mesh(colGeo, new THREE.MeshPhongMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 }));
        col.position.set(px * porticoW / 2, porticoH / 2, d / 2 + porticoD / 2);
        group.add(col);
      }
      const lintelGeo = new THREE.BoxGeometry(porticoW + 0.4, 0.25, porticoD);
      const lintel = new THREE.Mesh(lintelGeo, new THREE.MeshPhongMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.8 }));
      lintel.position.set(0, porticoH, d / 2 + porticoD / 2);
      group.add(lintel);

    // ====== 宿舍楼（学一~五公寓）======
    } else if (building.type === 'dormitory') {
      // 主体
      const mainGeo = new THREE.BoxGeometry(w, h, d);
      const mainMesh = new THREE.Mesh(mainGeo, material);
      mainMesh.position.y = h / 2;
      group.add(mainMesh);

      const edgeGeo = new THREE.EdgesGeometry(mainGeo);
      const edges = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edges.position.y = h / 2;
      group.add(edges);

      // 四面窗户网格（密集小窗）
      const windowMat = new THREE.MeshPhongMaterial({ color: 0xffffcc, transparent: true, opacity: 0.55 });
      for (let wy = 1; wy < h; wy += 0.9) {
        for (let wx = -w / 2 + 0.5; wx < w / 2; wx += 0.8) {
          const winGeo = new THREE.PlaneGeometry(0.35, 0.5);
          const winF = new THREE.Mesh(winGeo, windowMat);
          winF.position.set(wx, wy, d / 2 + 0.01);
          group.add(winF);
          const winB = new THREE.Mesh(winGeo, windowMat);
          winB.position.set(wx, wy, -d / 2 - 0.01);
          winB.rotation.y = Math.PI;
          group.add(winB);
        }
      }
      // 左右侧面
      for (let wy = 1; wy < h; wy += 0.9) {
        for (let wz = -d / 2 + 0.5; wz < d / 2; wz += 0.8) {
          const winGeo = new THREE.PlaneGeometry(0.35, 0.5);
          const winL = new THREE.Mesh(winGeo, windowMat);
          winL.rotation.y = -Math.PI / 2;
          winL.position.set(-w / 2 - 0.01, wy, wz);
          group.add(winL);
          const winR = new THREE.Mesh(winGeo, windowMat);
          winR.rotation.y = Math.PI / 2;
          winR.position.set(w / 2 + 0.01, wy, wz);
          group.add(winR);
        }
      }

      // 底层阳台突出
      const balconyGeo = new THREE.BoxGeometry(w * 0.9, 0.15, 0.6);
      const balconyMat = new THREE.MeshPhongMaterial({ color: 0x667788, transparent: true, opacity: 0.6 });
      for (let by = 1.8; by < h; by += 2.7) {
        const balcony = new THREE.Mesh(balconyGeo, balconyMat);
        balcony.position.set(0, by, d / 2 + 0.3);
        group.add(balcony);
      }

    // ====== 食堂（学一/二食堂）======
    } else if (building.type === 'canteen') {
      // 主体
      const mainGeo = new THREE.BoxGeometry(w, h, d);
      const mainMesh = new THREE.Mesh(mainGeo, material);
      mainMesh.position.y = h / 2;
      group.add(mainMesh);

      const edgeGeo = new THREE.EdgesGeometry(mainGeo);
      const edges = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edges.position.y = h / 2;
      group.add(edges);

      // 底层玻璃幕墙
      const glassFloorH = h * 0.4;
      const glassMat = new THREE.MeshPhongMaterial({ color: 0x88ccdd, transparent: true, opacity: 0.4 });
      const glassGeo = new THREE.PlaneGeometry(w * 0.95, glassFloorH);
      const glassF = new THREE.Mesh(glassGeo, glassMat);
      glassF.position.set(0, glassFloorH / 2, d / 2 + 0.02);
      group.add(glassF);
      const glassB = new THREE.Mesh(glassGeo, glassMat);
      glassB.position.set(0, glassFloorH / 2, -d / 2 - 0.02);
      glassB.rotation.y = Math.PI;
      group.add(glassB);

      // 宽入口雨棚
      const canopyGeo = new THREE.BoxGeometry(w * 0.7, 0.12, 2.5);
      const canopyMat = new THREE.MeshPhongMaterial({ color: 0x555555, transparent: true, opacity: 0.6 });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(0, h * 0.45, d / 2 + 1.25);
      group.add(canopy);
      for (let px = -1; px <= 1; px += 2) {
        const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, h * 0.45, 8);
        const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshPhongMaterial({ color: 0x444444 }));
        pillar.position.set(px * w * 0.3, h * 0.45 / 2, d / 2 + 2.3);
        group.add(pillar);
      }

      // 户外遮阳棚
      const outCanopyGeo = new THREE.BoxGeometry(w * 0.5, 0.08, 2);
      const outCanopyMat = new THREE.MeshPhongMaterial({ color: 0x778899, transparent: true, opacity: 0.5 });
      const outCanopy = new THREE.Mesh(outCanopyGeo, outCanopyMat);
      outCanopy.position.set(0, h * 0.5, d / 2 + 3.5);
      group.add(outCanopy);

    // ====== 设施建筑（数据中心等）======
    } else if (building.type === 'facility') {
      // 主体
      const mainGeo = new THREE.BoxGeometry(w, h, d);
      const mainMesh = new THREE.Mesh(mainGeo, material);
      mainMesh.position.y = h / 2;
      group.add(mainMesh);

      const edgeGeo = new THREE.EdgesGeometry(mainGeo);
      const edges = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edges.position.y = h / 2;
      group.add(edges);

      // 玻璃元素
      const glassMat = new THREE.MeshPhongMaterial({ color: 0x77aadd, transparent: true, opacity: 0.45 });
      for (let wy = 0.8; wy < h; wy += 1.5) {
        const bandGeo = new THREE.PlaneGeometry(w * 0.85, 0.6);
        const band = new THREE.Mesh(bandGeo, glassMat);
        band.position.set(0, wy, d / 2 + 0.02);
        group.add(band);
      }
      const sideGlassGeo = new THREE.PlaneGeometry(d * 0.8, h * 0.6);
      const sideGlass = new THREE.Mesh(sideGlassGeo, glassMat);
      sideGlass.rotation.y = Math.PI / 2;
      sideGlass.position.set(w / 2 + 0.02, h * 0.4, 0);
      group.add(sideGlass);

    // ====== 默认建筑 ======
    } else {
      const mainGeo = new THREE.BoxGeometry(w, h, d);
      const mainMesh = new THREE.Mesh(mainGeo, material);
      mainMesh.position.y = h / 2;
      group.add(mainMesh);

      const edgeGeo = new THREE.EdgesGeometry(mainGeo);
      const edges = new THREE.LineSegments(edgeGeo, edgeMaterial);
      edges.position.y = h / 2;
      group.add(edges);
    }

    // ====== 底座（所有建筑都有）======
    const baseGeo = new THREE.BoxGeometry(w + 0.5, 0.2, d + 0.5);
    const baseMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    group.add(base);

    // 定位
    group.position.set(building.offset[0], 0, building.offset[1]);

    group.userData = {
      buildingId: building.id,
      buildingData: building,
      originalColor: typeConfig.color,
      type: building.type
    };

    return group;
  }

  createBuildingLabel(building) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    const typeConfig = BUILDING_TYPES[building.type] || BUILDING_TYPES.facility;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();
    ctx.strokeStyle = '#' + typeConfig.color.toString(16).padStart(6, '0');
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(building.name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(20, 5, 1);
    sprite.position.set(building.offset[0], building.size[1] + 4, building.offset[1]);
    sprite.name = 'label-' + building.id;

    return sprite;
  }

  // ===== 加载场景内容 =====

  loadZones(zones, levelType) {
    this.clearAll();
    this.viewMode = 'zone';
    zones.forEach(data => {
      const group = this.createZoneMesh(data);
      this.scene.add(group);
      this.zones.push({ group, data });

      const label = this.createZoneLabel(data);
      this.scene.add(label);
      this.labels.push(label);
    });
    this.setCameraForLevel(levelType || 'district');
  }

  loadBuildings(buildings) {
    this.clearAll();
    this.viewMode = 'building';
    buildings.forEach(data => {
      this.addBuildingToScene(data);
    });

    // 添加校园地面
    this.addCampusGround();

    // 添加校园湖泊（西海）+ 燕水溪流
    this.addCampusLake();

    // 添加校园道路 + 广场 + 围墙
    this.addCampusRoads();

    // 添加校园树木
    this.addCampusTrees();

    // 添加东大门
    this.addCampusGate();

    this.setCameraForLevel('institution');
  }

  addCampusLake() {
    // ====== 西海湖泊 - 不规则自然形状，位于图书馆西侧 ======
    const lakeShape = new THREE.Shape();
    lakeShape.moveTo(0, 0);
    lakeShape.bezierCurveTo(4, 1, 7, -1, 9, 1);
    lakeShape.bezierCurveTo(10, 3, 9, 5, 7, 6);
    lakeShape.bezierCurveTo(5, 7.5, 3, 7, 1, 6);
    lakeShape.bezierCurveTo(-1, 5, -2, 3, -1, 1);
    lakeShape.bezierCurveTo(-0.5, 0.5, 0, 0.2, 0, 0);

    const lakeGeo = new THREE.ShapeGeometry(lakeShape, 32);
    const lakeMat = new THREE.MeshPhongMaterial({
      color: 0x1a5276, transparent: true, opacity: 0.75, side: THREE.DoubleSide
    });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-12, 0.05, 8);
    lake.name = 'campus-lake';
    this.scene.add(lake);
    this.labels.push(lake);

    // 湖泊边缘（浅色岸边）
    const edgeShape = new THREE.Shape();
    edgeShape.moveTo(0, 0);
    edgeShape.bezierCurveTo(4, 1, 7, -1, 9, 1);
    edgeShape.bezierCurveTo(10, 3, 9, 5, 7, 6);
    edgeShape.bezierCurveTo(5, 7.5, 3, 7, 1, 6);
    edgeShape.bezierCurveTo(-1, 5, -2, 3, -1, 1);
    edgeShape.bezierCurveTo(-0.5, 0.5, 0, 0.2, 0, 0);
    const edgeHole = new THREE.Path();
    const s = 0.85;
    edgeHole.moveTo(0 * s + 0.7, 0 * s + 0.5);
    edgeHole.bezierCurveTo(4 * s + 0.5, 1 * s + 0.5, 7 * s + 0.5, -1 * s + 0.5, 9 * s + 0.5, 1 * s + 0.5);
    edgeHole.bezierCurveTo(10 * s + 0.5, 3 * s + 0.5, 9 * s + 0.5, 5 * s + 0.5, 7 * s + 0.5, 6 * s + 0.5);
    edgeHole.bezierCurveTo(5 * s + 0.5, 7.5 * s + 0.5, 3 * s + 0.5, 7 * s + 0.5, 1 * s + 0.5, 6 * s + 0.5);
    edgeHole.bezierCurveTo(-1 * s + 0.5, 5 * s + 0.5, -2 * s + 0.5, 3 * s + 0.5, -1 * s + 0.5, 1 * s + 0.5);
    edgeHole.bezierCurveTo(-0.5 * s + 0.5, 0.5 * s + 0.5, 0 * s + 0.5, 0.2 * s + 0.5, 0 * s + 0.7, 0 * s + 0.5);
    edgeShape.holes.push(edgeHole);

    const lakeEdgeGeo = new THREE.ShapeGeometry(edgeShape, 32);
    const lakeEdgeMat = new THREE.MeshBasicMaterial({
      color: 0x2e86c1, transparent: true, opacity: 0.35, side: THREE.DoubleSide
    });
    const lakeEdge = new THREE.Mesh(lakeEdgeGeo, lakeEdgeMat);
    lakeEdge.rotation.x = -Math.PI / 2;
    lakeEdge.position.set(-12, 0.06, 8);
    lakeEdge.name = 'campus-lake-edge';
    this.scene.add(lakeEdge);
    this.labels.push(lakeEdge);

    // 湖心小岛
    const islandGeo = new THREE.CircleGeometry(1.2, 16);
    const islandMat = new THREE.MeshPhongMaterial({ color: 0x3d7a4a, transparent: true, opacity: 0.8 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.rotation.x = -Math.PI / 2;
    island.position.set(-8, 0.07, 11);
    island.name = 'campus-lake-island';
    this.scene.add(island);
    this.labels.push(island);

    // 小桥（连接岛与岸）
    const bridgeGeo = new THREE.BoxGeometry(0.6, 0.15, 3);
    const bridgeMat = new THREE.MeshPhongMaterial({ color: 0x8B7355, transparent: true, opacity: 0.85 });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(-8, 0.12, 9.5);
    bridge.rotation.y = Math.PI * 0.15;
    bridge.name = 'campus-lake-bridge';
    this.scene.add(bridge);
    this.labels.push(bridge);

    // ====== 燕水溪流 - 从北侧蜿蜒流入西海 ======
    const streamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-14, 0.08, -15),
      new THREE.Vector3(-13, 0.08, -10),
      new THREE.Vector3(-15, 0.08, -5),
      new THREE.Vector3(-13, 0.08, 0),
      new THREE.Vector3(-12, 0.08, 5),
      new THREE.Vector3(-12, 0.08, 8),
    ]);
    const streamGeo = new THREE.TubeGeometry(streamCurve, 32, 0.5, 8, false);
    const streamMat = new THREE.MeshPhongMaterial({
      color: 0x2980b9, transparent: true, opacity: 0.6, side: THREE.DoubleSide
    });
    const stream = new THREE.Mesh(streamGeo, streamMat);
    stream.name = 'campus-stream';
    this.scene.add(stream);
    this.labels.push(stream);
  }

  addCampusRoads() {
    const roadMat = new THREE.MeshBasicMaterial({
      color: 0x2a2a2a, transparent: true, opacity: 0.5
    });
    const roadSidewalkMat = new THREE.MeshBasicMaterial({
      color: 0x3a3a3a, transparent: true, opacity: 0.35
    });

    // ====== 信息路（东西主轴：东门→科技广场→图书馆→西门）======
    const mainEWRoadGeo = new THREE.PlaneGeometry(60, 2.5);
    const mainEWRoad = new THREE.Mesh(mainEWRoadGeo, roadMat);
    mainEWRoad.rotation.x = -Math.PI / 2;
    mainEWRoad.position.set(0, 0.02, 0);
    mainEWRoad.name = 'road-info-ew';
    this.scene.add(mainEWRoad);
    this.labels.push(mainEWRoad);

    // 人行道
    const sw1Geo = new THREE.PlaneGeometry(60, 0.8);
    const sw1a = new THREE.Mesh(sw1Geo, roadSidewalkMat);
    sw1a.rotation.x = -Math.PI / 2;
    sw1a.position.set(0, 0.03, 1.65);
    this.scene.add(sw1a);
    this.labels.push(sw1a);
    const sw1b = new THREE.Mesh(sw1Geo, roadSidewalkMat);
    sw1b.rotation.x = -Math.PI / 2;
    sw1b.position.set(0, 0.03, -1.65);
    this.scene.add(sw1b);
    this.labels.push(sw1b);

    // ====== 南北主路（图书馆→南门）======
    const mainNSRoadGeo = new THREE.PlaneGeometry(2.5, 40);
    const mainNSRoad = new THREE.Mesh(mainNSRoadGeo, roadMat);
    mainNSRoad.rotation.x = -Math.PI / 2;
    mainNSRoad.position.set(0, 0.02, -20);
    mainNSRoad.name = 'road-main-ns';
    this.scene.add(mainNSRoad);
    this.labels.push(mainNSRoad);

    // ====== 内环路（连接建筑群）======
    // 北段
    const ringN = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.8), roadMat);
    ringN.rotation.x = -Math.PI / 2;
    ringN.position.set(0, 0.02, -12);
    ringN.name = 'road-ring-n';
    this.scene.add(ringN);
    this.labels.push(ringN);

    // 南段
    const ringS = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.8), roadMat);
    ringS.rotation.x = -Math.PI / 2;
    ringS.position.set(0, 0.02, 12);
    ringS.name = 'road-ring-s';
    this.scene.add(ringS);
    this.labels.push(ringS);

    // 东段
    const ringE = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 24), roadMat);
    ringE.rotation.x = -Math.PI / 2;
    ringE.position.set(20, 0.02, 0);
    ringE.name = 'road-ring-e';
    this.scene.add(ringE);
    this.labels.push(ringE);

    // 西段
    const ringW = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 24), roadMat);
    ringW.rotation.x = -Math.PI / 2;
    ringW.position.set(-20, 0.02, 0);
    ringW.name = 'road-ring-w';
    this.scene.add(ringW);
    this.labels.push(ringW);

    // ====== 科技广场（东门入口大广场）======
    const techSquareGeo = new THREE.PlaneGeometry(12, 10);
    const techSquareMat = new THREE.MeshBasicMaterial({
      color: 0x333344, transparent: true, opacity: 0.4
    });
    const techSquare = new THREE.Mesh(techSquareGeo, techSquareMat);
    techSquare.rotation.x = -Math.PI / 2;
    techSquare.position.set(25, 0.03, 0);
    techSquare.name = 'campus-tech-square';
    this.scene.add(techSquare);
    this.labels.push(techSquare);

    // 旗杆
    const flagpoleGeo = new THREE.CylinderGeometry(0.06, 0.08, 6, 8);
    const flagpoleMat = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const flagpole = new THREE.Mesh(flagpoleGeo, flagpoleMat);
    flagpole.position.set(25, 3, 0);
    flagpole.name = 'campus-flagpole';
    this.scene.add(flagpole);
    this.labels.push(flagpole);

    // 旗帜
    const flagGeo = new THREE.PlaneGeometry(1.5, 1);
    const flagMat = new THREE.MeshPhongMaterial({ color: 0xcc0000, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(25.8, 5.5, 0);
    flag.name = 'campus-flag';
    this.scene.add(flag);
    this.labels.push(flag);

    // ====== 蔚蓝广场（体育馆与学生中心之间）======
    const weilanSquareGeo = new THREE.PlaneGeometry(10, 8);
    const weilanSquareMat = new THREE.MeshBasicMaterial({
      color: 0x1a3a6a, transparent: true, opacity: 0.45
    });
    const weilanSquare = new THREE.Mesh(weilanSquareGeo, weilanSquareMat);
    weilanSquare.rotation.x = -Math.PI / 2;
    weilanSquare.position.set(8, 0.03, -8);
    weilanSquare.name = 'campus-weilan-square';
    this.scene.add(weilanSquare);
    this.labels.push(weilanSquare);

    // ====== 校园边界（低矮围墙轮廓）======
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x445566, transparent: true, opacity: 0.3 });
    const wallH = 0.5, wallT = 0.15;
    // 北墙
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(70, wallH, wallT), wallMat);
    wallN.position.set(0, wallH / 2, -30);
    wallN.name = 'campus-wall-n';
    this.scene.add(wallN);
    this.labels.push(wallN);
    // 南墙
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(70, wallH, wallT), wallMat);
    wallS.position.set(0, wallH / 2, 30);
    wallS.name = 'campus-wall-s';
    this.scene.add(wallS);
    this.labels.push(wallS);
    // 东墙（留门缺口）
    const wallE1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 22), wallMat);
    wallE1.position.set(35, wallH / 2, -19);
    wallE1.name = 'campus-wall-e1';
    this.scene.add(wallE1);
    this.labels.push(wallE1);
    const wallE2 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 22), wallMat);
    wallE2.position.set(35, wallH / 2, 19);
    wallE2.name = 'campus-wall-e2';
    this.scene.add(wallE2);
    this.labels.push(wallE2);
    // 西墙（留门缺口）
    const wallW1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 22), wallMat);
    wallW1.position.set(-35, wallH / 2, -19);
    wallW1.name = 'campus-wall-w1';
    this.scene.add(wallW1);
    this.labels.push(wallW1);
    const wallW2 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 22), wallMat);
    wallW2.position.set(-35, wallH / 2, 19);
    wallW2.name = 'campus-wall-w2';
    this.scene.add(wallW2);
    this.labels.push(wallW2);
  }

  addCampusGround() {
    // 校园绿色地面（位于网格之下）
    const groundGeo = new THREE.PlaneGeometry(100, 80);
    const groundMat = new THREE.MeshPhongMaterial({
      color: 0x1a3320, transparent: true, opacity: 0.35, side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.01, 0);
    ground.name = 'campus-ground';
    this.scene.add(ground);
    this.labels.push(ground);

    // 绿化带散布
    const greenPatchMat = new THREE.MeshPhongMaterial({
      color: 0x2d5a3a, transparent: true, opacity: 0.4
    });
    const greenPatches = [
      { x: -8, z: -8, w: 5, d: 4 },
      { x: 12, z: 8, w: 4, d: 3 },
      { x: -18, z: 18, w: 6, d: 5 },
      { x: 15, z: -15, w: 3, d: 3 },
      { x: -25, z: -5, w: 4, d: 6 },
      { x: 5, z: 20, w: 5, d: 3 },
      { x: -15, z: -18, w: 3, d: 4 },
    ];
    greenPatches.forEach((p, i) => {
      const patchGeo = new THREE.PlaneGeometry(p.w, p.d);
      const patch = new THREE.Mesh(patchGeo, greenPatchMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(p.x, 0.01, p.z);
      patch.name = 'campus-green-' + i;
      this.scene.add(patch);
      this.labels.push(patch);
    });
  }

  addCampusTrees() {
    // 程序化树木：绿色锥体 + 棕色圆柱树干
    const treePositions = [
      // 信息路两侧
      [-8, 3], [-8, -3], [-4, 3], [-4, -3], [4, 3], [4, -3], [8, 3], [8, -3],
      [12, 3], [12, -3], [16, 3], [16, -3], [20, 3], [20, -3],
      // 内环路沿线
      [18, -10], [22, -10], [18, 10], [22, 10],
      [-18, -10], [-22, -10], [-18, 10], [-22, 10],
      [10, -12], [10, -14], [-10, -12], [-10, -14],
      [10, 12], [10, 14], [-10, 12], [-10, 14],
      // 湖畔
      [-10, 6], [-14, 10], [-16, 8], [-10, 14],
      // 科技广场周边
      [23, 4], [27, 4], [23, -4], [27, -4],
      // 建筑周边
      [-6, -18], [-6, -22], [6, -18], [6, -22],
      [14, 15], [18, 15], [-14, 20], [-18, 20],
      // 东南角
      [28, 18], [30, 20], [25, 22],
      // 西南角
      [-28, 18], [-30, 20], [-25, 22],
    ];

    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5c3a1e });
    const leafMat = new THREE.MeshPhongMaterial({ color: 0x2d6a3a, transparent: true, opacity: 0.85 });

    treePositions.forEach((pos, i) => {
      const trunkH = 0.8 + Math.random() * 0.5;
      const leafH = 1.2 + Math.random() * 0.8;
      const leafR = 0.6 + Math.random() * 0.4;

      const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(pos[0], trunkH / 2, pos[1]);

      const leafGeo = new THREE.ConeGeometry(leafR, leafH, 7);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(pos[0], trunkH + leafH / 2, pos[1]);

      trunk.name = 'campus-tree-trunk-' + i;
      leaf.name = 'campus-tree-leaf-' + i;
      this.scene.add(trunk);
      this.scene.add(leaf);
      this.labels.push(trunk);
      this.labels.push(leaf);
    });
  }

  addCampusGate() {
    // ====== 东大门 - 气派的校门结构 ======
    const gateGroup = new THREE.Group();

    // 门柱（左右）
    const pillarMat = new THREE.MeshPhongMaterial({ color: 0x999999, transparent: true, opacity: 0.85 });
    for (let px = -1; px <= 1; px += 2) {
      const pillarGeo = new THREE.BoxGeometry(0.6, 4, 0.6);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px * 2.5, 2, 0);
      gateGroup.add(pillar);

      // 门柱顶部装饰
      const capGeo = new THREE.BoxGeometry(0.8, 0.3, 0.8);
      const cap = new THREE.Mesh(capGeo, new THREE.MeshPhongMaterial({ color: 0xaaaaaa }));
      cap.position.set(px * 2.5, 4.15, 0);
      gateGroup.add(cap);
    }

    // 横梁
    const beamGeo = new THREE.BoxGeometry(5.6, 0.4, 0.5);
    const beamMat = new THREE.MeshPhongMaterial({ color: 0x888888, transparent: true, opacity: 0.85 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 3.8, 0);
    gateGroup.add(beam);

    // 校名牌匾（用sprite模拟）
    const signCanvas = document.createElement('canvas');
    const sCtx = signCanvas.getContext('2d');
    signCanvas.width = 256;
    signCanvas.height = 64;
    sCtx.fillStyle = 'rgba(20, 30, 50, 0.9)';
    sCtx.fillRect(0, 0, 256, 64);
    sCtx.fillStyle = '#ccddff';
    sCtx.font = 'bold 24px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText('BISTU', 128, 32);
    const signTexture = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.SpriteMaterial({ map: signTexture, transparent: true, opacity: 0.9 });
    const sign = new THREE.Sprite(signMat);
    sign.scale.set(4, 1, 1);
    sign.position.set(0, 5, 0);
    gateGroup.add(sign);

    gateGroup.position.set(35, 0, 0);
    gateGroup.rotation.y = Math.PI / 2;
    gateGroup.name = 'campus-east-gate';
    this.scene.add(gateGroup);
    this.labels.push(gateGroup);
  }

  addBuildingToScene(data) {
    const group = this.createBuildingMesh(data);
    this.scene.add(group);
    this.buildings.push({ group, data });

    const label = this.createBuildingLabel(data);
    this.scene.add(label);
    this.labels.push(label);
  }

  removeBuildingFromScene(id) {
    const idx = this.buildings.findIndex(b => b.data.id === id);
    if (idx === -1) return;
    this.scene.remove(this.buildings[idx].group);
    this.buildings.splice(idx, 1);

    const labelIdx = this.labels.findIndex(l => l.name === 'label-' + id);
    if (labelIdx !== -1) {
      this.scene.remove(this.labels[labelIdx]);
      this.labels.splice(labelIdx, 1);
    }

    if (this.selectedBuilding && this.selectedBuilding.data.id === id) {
      this.selectedBuilding = null;
    }
  }

  clearAll() {
    this.buildings.forEach(b => this.scene.remove(b.group));
    this.zones.forEach(z => this.scene.remove(z.group));
    this.labels.forEach(l => this.scene.remove(l));
    this.buildings = [];
    this.zones = [];
    this.labels = [];
    this.selectedBuilding = null;
    this.hoveredZone = null;
    this.hoveredBuilding = null;
  }

  // ===== 射线检测 =====

  updateMouse(event) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getGroundPoint() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.groundPlane);
    if (intersects.length > 0) return intersects[0].point;
    return null;
  }

  getBuildingHit() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = [];
    this.buildings.forEach(b => {
      b.group.children.forEach(child => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
    });
    const hits = this.raycaster.intersectObjects(meshes);
    if (hits.length === 0) return null;
    let group = hits[0].object.parent;
    while (group && !group.userData.buildingData) {
      group = group.parent;
    }
    return group;
  }

  getZoneHit() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = [];
    this.zones.forEach(z => {
      z.group.children.forEach(child => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
    });
    const hits = this.raycaster.intersectObjects(meshes);
    if (hits.length === 0) return null;
    let group = hits[0].object.parent;
    while (group && !group.userData.zoneData) {
      group = group.parent;
    }
    return group;
  }

  // ===== 碰撞检测 =====

  checkCollision(offsetX, offsetZ, size, excludeId) {
    const halfW = size[0] / 2;
    const halfD = size[2] / 2;
    for (const b of this.buildings) {
      if (b.data.id === excludeId) continue;
      const bx = b.data.offset[0];
      const bz = b.data.offset[1];
      const bHalfW = b.data.size[0] / 2;
      const bHalfD = b.data.size[2] / 2;
      if (Math.abs(offsetX - bx) < halfW + bHalfW && Math.abs(offsetZ - bz) < halfD + bHalfD) {
        return true;
      }
    }
    return false;
  }

  // ===== 鼠标事件 =====

  setupEvents() {
    this.container.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.container.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  onMouseDown(event) {
    this.updateMouse(event);

    if (event.button === 2) {
      if (this.isPlacingMode) {
        this.exitPlaceMode();
        if (this.onPlacingCancel) this.onPlacingCancel();
      } else if (this.isDragging) {
        this.cancelDrag();
      } else {
        this.deselectBuilding();
      }
      return;
    }

    if (event.button !== 0) return;

    // 区域块模式
    if (this.viewMode === 'zone') {
      const hitGroup = this.getZoneHit();
      if (hitGroup) {
        const zoneData = hitGroup.userData.zoneData;
        if (this.onZoneClick) this.onZoneClick(zoneData.id);
      }
      return;
    }

    // 放置模式
    if (this.isPlacingMode) {
      if (this.placingLocked || this.collisionDetected) return;
      if (this.previewGroup.visible) {
        this.placingLocked = true;
        if (this.onPlacingClick) this.onPlacingClick();
      }
      return;
    }

    // 建筑模式
    const hitGroup = this.getBuildingHit();
    if (hitGroup) {
      const bData = this.buildings.find(b => b.group === hitGroup);
      if (bData) {
        this.selectBuilding(bData);
        this.isDragging = true;
        this.dragStartWorld = this.getGroundPoint();
        this.dragStartOffset = bData.data.offset.slice();
        this.controls.enabled = false; // 禁用轨道控制，允许拖拽
      }
    } else {
      this.deselectBuilding();
    }
  }

  onMouseMove(event) {
    this.updateMouse(event);

    // 拖拽建筑
    if (this.isDragging && this.selectedBuilding) {
      const groundPoint = this.getGroundPoint();
      if (!groundPoint || !this.dragStartWorld) return;

      const dx = groundPoint.x - this.dragStartWorld.x;
      const dz = groundPoint.z - this.dragStartWorld.z;

      const newOffsetX = this.dragStartOffset[0] + dx;
      const newOffsetZ = this.dragStartOffset[1] + dz;
      this.selectedBuilding.data.offset[0] = newOffsetX;
      this.selectedBuilding.data.offset[1] = newOffsetZ;
      this.selectedBuilding.group.position.set(newOffsetX, 0, newOffsetZ);

      // 更新标签
      const label = this.labels.find(l => l.name === 'label-' + this.selectedBuilding.data.id);
      if (label) {
        label.position.set(newOffsetX, this.selectedBuilding.data.size[1] + 4, newOffsetZ);
      }

      // 碰撞检测
      const collides = this.checkCollision(newOffsetX, newOffsetZ, this.selectedBuilding.data.size, this.selectedBuilding.data.id);
      this.setBuildingColor(this.selectedBuilding.group, collides ? 0xff3333 : BUILDING_TYPES[this.selectedBuilding.data.type].color, true);
      return;
    }

    // 区域块悬浮
    if (this.viewMode === 'zone') {
      const hitGroup = this.getZoneHit();
      if (hitGroup !== this.hoveredZone) {
        if (this.hoveredZone) this.resetColor(this.hoveredZone);
        if (hitGroup) {
          hitGroup.children.forEach(c => {
            if (c.material && c.material.opacity !== undefined) c.material.opacity = 0.5;
          });
          this.container.style.cursor = 'pointer';
        } else {
          this.container.style.cursor = '';
        }
        this.hoveredZone = hitGroup;
      }
      return;
    }

    // 放置模式预览
    if (this.isPlacingMode && !this.placingLocked) {
      const groundPoint = this.getGroundPoint();
      if (groundPoint) {
        this.previewGroup.visible = true;
        this.previewGroup.position.set(groundPoint.x, 0, groundPoint.z);
        const defaultSizes = { school: [10, 5, 7], office: [8, 5, 6], dormitory: [10, 7, 3], facility: [7, 3, 5], library: [14, 7, 12], gym: [14, 4, 10], canteen: [9, 3, 7] };
        const size = defaultSizes[this.placingType] || defaultSizes.facility;
        this.previewGroup.scale.set(size[0], size[1], size[2]);
        this.previewGroup.children[0].position.y = 0.5;
        this.previewGroup.children[1].position.y = 0.5;
        this.collisionDetected = this.checkCollision(groundPoint.x, groundPoint.z, size, -1);
        const typeConfig = BUILDING_TYPES[this.placingType] || BUILDING_TYPES.facility;
        this.previewGroup.children[0].material.color.setHex(this.collisionDetected ? 0xff3333 : typeConfig.color);
      } else {
        this.previewGroup.visible = false;
        this.collisionDetected = true;
      }
      return;
    }

    // 建筑悬浮
    if (!this.isDragging && !this.isPlacingMode) {
      const hitGroup = this.getBuildingHit();
      const hitData = hitGroup ? this.buildings.find(b => b.group === hitGroup) : null;

      if (hitData !== this.hoveredBuilding) {
        if (this.hoveredBuilding && this.hoveredBuilding !== this.selectedBuilding) {
          this.resetBuildingColor(this.hoveredBuilding.group);
        }
        if (hitData && hitData !== this.selectedBuilding) {
          this.setBuildingColor(hitData.group, BUILDING_TYPES[hitData.data.type].color, true);
        }
        this.container.style.cursor = hitData ? 'pointer' : '';
        this.hoveredBuilding = hitData;
        if (this.onBuildingHover) {
          this.onBuildingHover(hitData ? hitData.data : null, event);
        }
      }
      if (this.hoveredBuilding && this.onBuildingHover) {
        this.onBuildingHover(this.hoveredBuilding.data, event);
      }
    }
  }

  onMouseUp(event) {
    if (!this.isDragging || !this.selectedBuilding) return;

    this.isDragging = false;
    this.controls.enabled = true;

    const data = this.selectedBuilding.data;
    const collides = this.checkCollision(data.offset[0], data.offset[1], data.size, data.id);

    if (collides) {
      // 弹回原位
      data.offset[0] = this.dragStartOffset[0];
      data.offset[1] = this.dragStartOffset[1];
      this.selectedBuilding.group.position.set(data.offset[0], 0, data.offset[1]);
      const label = this.labels.find(l => l.name === 'label-' + data.id);
      if (label) label.position.set(data.offset[0], data.size[1] + 4, data.offset[1]);
      this.resetBuildingColor(this.selectedBuilding.group);
      this.selectBuilding(this.selectedBuilding);
    } else if (this.dragStartOffset[0] !== data.offset[0] || this.dragStartOffset[1] !== data.offset[1]) {
      this.resetBuildingColor(this.selectedBuilding.group);
      this.selectBuilding(this.selectedBuilding);
      if (this.onBuildingMove) this.onBuildingMove(data);
    } else {
      this.resetBuildingColor(this.selectedBuilding.group);
      this.selectBuilding(this.selectedBuilding);
    }

    this.dragStartWorld = null;
    this.dragStartOffset = null;
  }

  cancelDrag() {
    if (!this.isDragging || !this.selectedBuilding) return;
    this.isDragging = false;
    this.controls.enabled = true;

    const data = this.selectedBuilding.data;
    data.offset[0] = this.dragStartOffset[0];
    data.offset[1] = this.dragStartOffset[1];
    this.selectedBuilding.group.position.set(data.offset[0], 0, data.offset[1]);
    const label = this.labels.find(l => l.name === 'label-' + data.id);
    if (label) label.position.set(data.offset[0], data.size[1] + 4, data.offset[1]);

    this.resetBuildingColor(this.selectedBuilding.group);
    this.selectBuilding(this.selectedBuilding);
    this.dragStartWorld = null;
    this.dragStartOffset = null;
  }

  resetColor(group) {
    const color = group.userData.originalColor || 0x7b8a9e;
    group.children.forEach(c => {
      if (c.material) {
        if (c.material.color) c.material.color.setHex(color);
        if (c.material.opacity !== undefined && group.userData.zoneData) c.material.opacity = 0.3;
      }
    });
  }

  // ===== 选择/取消 =====

  selectBuilding(bData) {
    if (this.selectedBuilding && this.selectedBuilding !== bData) {
      this.resetBuildingColor(this.selectedBuilding.group);
    }
    this.selectedBuilding = bData;
    const typeConfig = BUILDING_TYPES[bData.data.type];
    this.setBuildingColor(bData.group, typeConfig.color, true);
    if (this.onBuildingSelect) this.onBuildingSelect(bData.data);
  }

  deselectBuilding() {
    if (this.selectedBuilding) {
      this.resetBuildingColor(this.selectedBuilding.group);
    }
    this.selectedBuilding = null;
    if (this.onBuildingDeselect) this.onBuildingDeselect();
  }

  setBuildingColor(group, color, highlight) {
    group.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.material && child.material.color) {
        child.material.color.setHex(color);
        if (highlight) {
          child.material.emissive = new THREE.Color(color).multiplyScalar(0.15);
        }
      }
    });
  }

  resetBuildingColor(group) {
    const color = group.userData.originalColor || 0x7b8a9e;
    group.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.material && child.material.color) {
        child.material.color.setHex(color);
        child.material.emissive = new THREE.Color(0x000000);
      }
    });
  }

  // ===== 放置模式 =====

  enterPlaceMode(type) {
    this.isPlacingMode = true;
    this.placingType = type;
    this.placingLocked = false;
    this.collisionDetected = false;
    this.previewGroup.visible = false;
    const typeConfig = BUILDING_TYPES[type] || BUILDING_TYPES.facility;
    this.previewGroup.children[0].material.color.setHex(typeConfig.color);
    this.previewGroup.children[1].material.color.setHex(typeConfig.color);
  }

  exitPlaceMode() {
    this.isPlacingMode = false;
    this.placingLocked = false;
    this.collisionDetected = false;
    this.previewGroup.visible = false;
  }

  confirmPlacement(name) {
    if (!this.placingLocked || !this.previewGroup.visible) return null;

    const px = this.previewGroup.position.x;
    const pz = this.previewGroup.position.z;
    const typeConfig = BUILDING_TYPES[this.placingType] || BUILDING_TYPES.facility;
    const defaultSizes = { school: [10, 5, 7], office: [8, 5, 6], dormitory: [10, 7, 3], facility: [7, 3, 5], library: [14, 7, 12], gym: [14, 4, 10], canteen: [9, 3, 7] };
    const size = defaultSizes[this.placingType] || defaultSizes.facility;
    const id = Date.now();
    const buildingName = name || (typeConfig.label + (id % 1000));

    const buildingData = {
      id, name: buildingName, type: this.placingType,
      offset: [Math.round(px), Math.round(pz)],
      size, floors: Math.ceil(size[1] / 3),
      area: size[0] * size[2] * Math.ceil(size[1] / 3),
      capacity: Math.round(size[0] * size[2] * 2),
      year: new Date().getFullYear()
    };

    this.addBuildingToScene(buildingData);
    this.exitPlaceMode();

    if (this.onBuildingAdded) this.onBuildingAdded(buildingData);
    return buildingData;
  }

  deleteBuilding(id) {
    this.removeBuildingFromScene(id);
    if (this.onBuildingDeleted) this.onBuildingDeleted(id);
  }

  focusOn(bData) {
    this.focusOnPosition(bData.data.offset[0], bData.data.offset[1]);
  }

  dispose() {
    this.clearAll();
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this.controls) this.controls.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
