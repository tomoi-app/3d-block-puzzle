// js/main.js

let scene, camera, renderer;
let translationGroup, rotationGroup, blockGroup, landedBlocksGroup;
let lastTime = 0;
const dropInterval = 800; // 落下速度(ms)
let dropTimer = 0;

function init() {
  // 1. シーン・カメラ・レンダラーの構築
  const container = document.getElementById("game-container");
  scene = new THREE.Scene();

  // カメラ（斜め見下ろし視点）
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(5, 20, 20);
  camera.lookAt(5, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 2. 照明の設定
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // 3. ゲーム用グループの初期化（プロトタイプの構造）
  translationGroup = new THREE.Group();
  rotationGroup = new THREE.Group();
  blockGroup = new THREE.Group();
  landedBlocksGroup = new THREE.Group();

  translationGroup.add(rotationGroup);
  rotationGroup.add(blockGroup);
  scene.add(translationGroup);
  scene.add(landedBlocksGroup);

  // TODO: ここで最初のブロックを生成し、blockGroupに追加する処理を呼ぶ
  // TODO: input.js からUIのイベントリスナーを登録する処理を呼ぶ

  // リサイズ対応
  window.addEventListener("resize", onWindowResize);

  // メインループ開始
  requestAnimationFrame(animate);
}

function animate(time) {
  requestAnimationFrame(animate);

  const deltaTime = time - lastTime;
  lastTime = time;

  // ゲームループ（重力による自動落下）
  dropTimer += deltaTime;
  if (dropTimer > dropInterval) {
    dropTimer = 0;
    // TODO: 下に移動できるか衝突判定し、可能ならYを-1。不可なら固定して再生成。
  }

  // TODO: カメラの自動追従ロジック（landedBlocksGroupの最高高度を計算してcamera.position.yを追従）

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// アプリ起動
init();
